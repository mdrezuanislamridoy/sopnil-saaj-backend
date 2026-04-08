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

const productInclude = {
  category: true,
  variants: { orderBy: { price: 'asc' as const } },
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

  private rethrowOrWrap(error: unknown, fallback: string): never {
    console.error('Error details:', error);
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) throw error;
    throw new InternalServerErrorException(fallback);
  }

  async create(dto: CreateProductDto, image?: Express.Multer.File) {
    try {
      console.log('Received DTO:', JSON.stringify(dto, null, 2));
      console.log('Variants:', dto.variants);
      
      const slug = dto.slug ?? this.toSlug(dto.name);

      const existing = await this.prisma.client.product.findUnique({ where: { slug } });
      if (existing) throw new BadRequestException('Product with this slug already exists');

      const category = await this.prisma.client.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');

      let imageUrl: string | undefined;
      let imagePublicId: string | undefined;

      if (image) {
        const uploaded = await this.cloudinary.uploadFile(image, 'products');
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
      }

      const product = await this.prisma.client.product.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          sku: dto.sku,
          isFeatured: dto.isFeatured ?? false,
          categoryId: dto.categoryId,
          imageUrl,
          imagePublicId,
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

      return successResponse('Product created', product);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to create product');
    }
  }

  async findAll(featured?: boolean) {
    try {
      const products = await this.prisma.client.product.findMany({
        where: { isActive: true, ...(featured !== undefined && { isFeatured: featured }) },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
      });
      return successResponse('Products fetched', products);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch products');
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
      this.rethrowOrWrap(error, 'Failed to fetch product');
    }
  }

  async findByCategory(categoryId: string) {
    try {
      const products = await this.prisma.client.product.findMany({
        where: { categoryId, isActive: true },
        include: productInclude,
        orderBy: { createdAt: 'desc' },
      });
      return successResponse('Products fetched', products);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch products by category');
    }
  }

  async update(id: string, dto: UpdateProductDto, image?: Express.Multer.File) {
    try {
      const product = await this.prisma.client.product.findUnique({ where: { id } });
      if (!product) throw new NotFoundException('Product not found');

      let imageUrl = product.imageUrl ?? undefined;
      let imagePublicId = product.imagePublicId ?? undefined;

      if (image) {
        if (imagePublicId) await this.cloudinary.deleteFile(imagePublicId);
        const uploaded = await this.cloudinary.uploadFile(image, 'products');
        imageUrl = uploaded.url;
        imagePublicId = uploaded.publicId;
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
          imageUrl,
          imagePublicId,
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
      this.rethrowOrWrap(error, 'Failed to update product');
    }
  }

  async remove(id: string) {
    try {
      const product = await this.prisma.client.product.findUnique({ where: { id } });
      if (!product) throw new NotFoundException('Product not found');

      if (product.imagePublicId) await this.cloudinary.deleteFile(product.imagePublicId);

      await this.prisma.client.product.delete({ where: { id } });
      return successResponse('Product deleted');
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to delete product');
    }
  }
}
