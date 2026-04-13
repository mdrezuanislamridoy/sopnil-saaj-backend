import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { CloudinaryService } from 'src/config/cloudinary/cloudinary.service';
import { successResponse } from 'src/common/response';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { FilterProductDto, SortBy } from './dto/filter-product.dto';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

const productInclude = {
  category: true,
  variants: { orderBy: { price: 'asc' as const } },
  images: { orderBy: { order: 'asc' as const } },
  reviews: {
    select: {
      rating: true,
    },
  },
};

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private toSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  async create(dto: CreateProductDto, images?: Express.Multer.File[]) {
    try {
      console.log('[ProductService] Create request received');
      console.log('[ProductService] DTO:', JSON.stringify(dto, null, 2));
      console.log('[ProductService] Images count:', images?.length ?? 0);
      
      if (images && images.length > 0) {
        console.log('[ProductService] Image details:', images.map(img => ({
          fieldname: img.fieldname,
          originalname: img.originalname,
          size: img.size,
          mimetype: img.mimetype,
        })));
      }

      const slug = dto.slug ?? this.toSlug(dto.name);

      const existing = await this.prisma.client.product.findUnique({ where: { slug } });
      if (existing) throw new BadRequestException('Product with this slug already exists');

      const category = await this.prisma.client.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');

      // Upload images to Cloudinary
      const uploadedImages: { url: string; publicId: string; order: number }[] = [];
      if (images && images.length > 0) {
        if (images.length > 5) {
          throw new BadRequestException('Maximum 5 images allowed');
        }
        
        console.log('[ProductService] Starting image uploads to Cloudinary...');
        for (let i = 0; i < images.length; i++) {
          try {
            console.log(`[ProductService] Uploading image ${i + 1}/${images.length}...`);
            const uploaded = await this.cloudinary.uploadFile(images[i], 'products');
            console.log(`[ProductService] Image ${i + 1} uploaded successfully:`, uploaded);
            uploadedImages.push({
              url: uploaded.url,
              publicId: uploaded.publicId,
              order: i,
            });
          } catch (error) {
            console.error(`[ProductService] Failed to upload image ${i + 1}:`, error);
            throw error;
          }
        }
        console.log('[ProductService] All images uploaded successfully');
      }

      const product = await this.prisma.client.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          sku: dto.sku,
          isFeatured: dto.isFeatured ?? false,
          categoryId: dto.categoryId,
          images: {
            create: uploadedImages,
          },
          variants: {
            create: dto.variants.map((v) => ({
              size: v.size,
              price: v.price,
              comparePrice: v.comparePrice,
              stock: v.stock ?? 0,
            })),
          },
        },
        include: productInclude,
      });

      console.log('[ProductService] Product created successfully:', product.id);
      return successResponse('Product created', product);
    } catch (error) {
      console.error('[ProductService] Create error:', error);
      handlePrismaError(error, 'Failed to create product');
    }
  }

  async findAll(filters: FilterProductDto) {
    try {
      const {
        categoryId,
        minPrice,
        maxPrice,
        minRating,
        name,
        sizes,
        sortBy,
        page = 1,
        limit = 20,
        featured,
      } = filters;

      // Build where clause
      const where: any = { isActive: true };

      if (categoryId) where.categoryId = categoryId;
      if (featured !== undefined) where.isFeatured = featured;
      if (name) where.name = { contains: name, mode: 'insensitive' };

      // Price filter (check variants)
      if (minPrice !== undefined || maxPrice !== undefined) {
        where.variants = {
          some: {
            ...(minPrice !== undefined && { price: { gte: minPrice } }),
            ...(maxPrice !== undefined && { price: { lte: maxPrice } }),
          },
        };
      }

      // Size filter
      if (sizes && sizes.length > 0) {
        where.variants = {
          ...where.variants,
          some: {
            ...where.variants?.some,
            size: { in: sizes },
          },
        };
      }

      // Determine orderBy based on sortBy
      let orderBy: any = { createdAt: 'desc' }; // Default

      if (sortBy) {
        switch (sortBy) {
          case SortBy.NAME_A_TO_Z:
            orderBy = { name: 'asc' };
            break;
          case SortBy.NAME_Z_TO_A:
            orderBy = { name: 'desc' };
            break;
          case SortBy.NEWEST:
            orderBy = { createdAt: 'desc' };
            break;
          case SortBy.OLDEST:
            orderBy = { createdAt: 'asc' };
            break;
          // Price and rating sorting will be done in-memory (unavoidable)
          case SortBy.PRICE_LOW_TO_HIGH:
          case SortBy.PRICE_HIGH_TO_LOW:
          case SortBy.RATING_HIGH_TO_LOW:
          case SortBy.RATING_LOW_TO_HIGH:
            orderBy = { createdAt: 'desc' }; // Fetch by date, sort later
            break;
        }
      }

      // If minRating is specified OR sorting by price/rating, we need all products
      const needsInMemoryProcessing =
        minRating !== undefined ||
        sortBy === SortBy.PRICE_LOW_TO_HIGH ||
        sortBy === SortBy.PRICE_HIGH_TO_LOW ||
        sortBy === SortBy.RATING_HIGH_TO_LOW ||
        sortBy === SortBy.RATING_LOW_TO_HIGH;

      if (needsInMemoryProcessing) {
        // Fetch all matching products (can't avoid for rating filter/sort)
        const allProducts = await this.prisma.client.product.findMany({
          where,
          include: productInclude,
        });

        // Calculate average rating
        let productsWithRating = allProducts.map((product) => {
          const avgRating =
            product.reviews.length > 0
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
          return { ...product, avgRating };
        });

        // Filter by minimum rating
        if (minRating !== undefined) {
          productsWithRating = productsWithRating.filter((p) => p.avgRating >= minRating);
        }

        // Sort
        if (sortBy) {
          productsWithRating.sort((a, b) => {
            switch (sortBy) {
              case SortBy.PRICE_LOW_TO_HIGH:
                return Number(a.variants[0]?.price ?? 0) - Number(b.variants[0]?.price ?? 0);
              case SortBy.PRICE_HIGH_TO_LOW:
                return Number(b.variants[0]?.price ?? 0) - Number(a.variants[0]?.price ?? 0);
              case SortBy.NAME_A_TO_Z:
                return a.name.localeCompare(b.name);
              case SortBy.NAME_Z_TO_A:
                return b.name.localeCompare(a.name);
              case SortBy.NEWEST:
                return b.createdAt.getTime() - a.createdAt.getTime();
              case SortBy.OLDEST:
                return a.createdAt.getTime() - b.createdAt.getTime();
              case SortBy.RATING_HIGH_TO_LOW:
                return b.avgRating - a.avgRating;
              case SortBy.RATING_LOW_TO_HIGH:
                return a.avgRating - b.avgRating;
              default:
                return 0;
            }
          });
        } else {
          productsWithRating.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        // Pagination
        const total = productsWithRating.length;
        const skip = (page - 1) * limit;
        const paginatedProducts = productsWithRating.slice(skip, skip + limit);

        // Remove reviews from response
        const result = paginatedProducts.map(({ reviews, ...product }) => product);

        return successResponse('Products fetched', {
          products: result,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      } else {
        // Optimized path: Use database-level pagination and sorting
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
          this.prisma.client.product.findMany({
            where,
            include: productInclude,
            orderBy,
            skip,
            take: limit,
          }),
          this.prisma.client.product.count({ where }),
        ]);

        // Calculate rating for display only
        const result = products.map((product) => {
          const avgRating =
            product.reviews.length > 0
              ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
              : 0;
          const { reviews, ...rest } = product;
          return { ...rest, avgRating };
        });

        return successResponse('Products fetched', {
          products: result,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      }
    } catch (error) {
      handlePrismaError(error, 'Failed to fetch products');
    }
  }

  async findOne(id: string) {
    try {
      const product = await this.prisma.client.product.findUnique({
        where: { id },
        include: productInclude,
      });
      if (!product) throw new NotFoundException('Product not found');
      return successResponse('Product fetched', product);
    } catch (error) {
      handlePrismaError(error, 'Failed to fetch product');
    }
  }

  async update(id: string, dto: UpdateProductDto, images?: Express.Multer.File[]) {
    try {
      const product = await this.prisma.client.product.findUnique({ 
        where: { id },
        include: { images: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      // Handle image removal
      if (dto.removeImageIds && dto.removeImageIds.length > 0) {
        const imagesToRemove = product.images.filter(img => 
          dto.removeImageIds!.includes(img.id)
        );
        
        // Delete from Cloudinary
        for (const img of imagesToRemove) {
          await this.cloudinary.deleteFile(img.publicId);
        }
        
        // Delete from database
        await this.prisma.client.productImage.deleteMany({
          where: { id: { in: dto.removeImageIds } },
        });
      }

      // Upload new images
      const uploadedImages: { url: string; publicId: string; order: number }[] = [];
      if (images && images.length > 0) {
        const currentImageCount = product.images.length - (dto.removeImageIds?.length ?? 0);
        if (currentImageCount + images.length > 5) {
          throw new BadRequestException('Maximum 5 images allowed per product');
        }
        
        const startOrder = product.images.length;
        for (let i = 0; i < images.length; i++) {
          const uploaded = await this.cloudinary.uploadFile(images[i], 'products');
          uploadedImages.push({
            url: uploaded.url,
            publicId: uploaded.publicId,
            order: startOrder + i,
          });
        }
      }

      const { name, slug, description, sku, isFeatured, isActive, categoryId, variants } = dto;

      const updated = await this.prisma.client.product.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(description !== undefined && { description }),
          ...(sku !== undefined && { sku }),
          ...(isFeatured !== undefined && { isFeatured: Boolean(isFeatured) }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          ...(categoryId !== undefined && { categoryId }),
          ...(uploadedImages.length > 0 && {
            images: {
              create: uploadedImages,
            },
          }),
          ...(variants && {
            variants: {
              deleteMany: {},
              create: variants.map((v) => ({
                size: v.size,
                price: v.price,
                comparePrice: v.comparePrice,
                stock: v.stock ?? 0,
              })),
            },
          }),
        },
        include: productInclude,
      });

      return successResponse('Product updated', updated);
    } catch (error) {
      handlePrismaError(error, 'Failed to update product');
    }
  }

  async remove(id: string) {
    try {
      const product = await this.prisma.client.product.findUnique({ 
        where: { id },
        include: { images: true },
      });
      if (!product) throw new NotFoundException('Product not found');

      // Delete all images from Cloudinary
      for (const image of product.images) {
        await this.cloudinary.deleteFile(image.publicId);
      }

      await this.prisma.client.product.delete({ where: { id } });
      return successResponse('Product deleted');
    } catch (error) {
      handlePrismaError(error, 'Failed to delete product');
    }
  }
}
