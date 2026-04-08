import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { CloudinaryService } from 'src/config/cloudinary/cloudinary.service';
import { successResponse } from 'src/common/response';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  private toSlug(name: string) {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  private rethrowOrWrap(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) throw error;
    throw new InternalServerErrorException(fallback);
  }

  async create(dto: CreateCategoryDto, icon?: Express.Multer.File) {
    try {
      const slug = dto.slug ?? this.toSlug(dto.name);

      const existing = await this.prisma.client.category.findUnique({ where: { slug } });
      if (existing) throw new BadRequestException('Category with this slug already exists');

      let iconUrl: string | undefined;
      let iconPublicId: string | undefined;

      if (icon) {
        const uploaded = await this.cloudinary.uploadFile(icon, 'categories');
        iconUrl = uploaded.url;
        iconPublicId = uploaded.publicId;
      }

      const category = await this.prisma.client.category.create({
        data: { name: dto.name, slug, iconUrl, iconPublicId },
      });

      return successResponse('Category created', category);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to create category');
    }
  }

  async findAll() {
    try {
      const categories = await this.prisma.client.category.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      });
      return successResponse('Categories fetched', categories);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch categories');
    }
  }

  async findOne(id: string) {
    try {
      const category = await this.prisma.client.category.findUnique({ where: { id } });
      if (!category) throw new NotFoundException('Category not found');
      return successResponse('Category fetched', category);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch category');
    }
  }

  async update(id: string, dto: UpdateCategoryDto, icon?: Express.Multer.File) {
    try {
      const category = await this.prisma.client.category.findUnique({ where: { id } });
      if (!category) throw new NotFoundException('Category not found');

      let iconUrl = category.iconUrl ?? undefined;
      let iconPublicId = category.iconPublicId ?? undefined;

      if (icon) {
        if (iconPublicId) await this.cloudinary.deleteFile(iconPublicId);
        const uploaded = await this.cloudinary.uploadFile(icon, 'categories');
        iconUrl = uploaded.url;
        iconPublicId = uploaded.publicId;
      }

      const { name, slug, isActive } = dto;

      const updated = await this.prisma.client.category.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(slug !== undefined && { slug }),
          ...(isActive !== undefined && { isActive: Boolean(isActive) }),
          iconUrl,
          iconPublicId,
        },
      });

      return successResponse('Category updated', updated);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to update category');
    }
  }

  async remove(id: string) {
    try {
      const category = await this.prisma.client.category.findUnique({ where: { id } });
      if (!category) throw new NotFoundException('Category not found');

      if (category.iconPublicId) await this.cloudinary.deleteFile(category.iconPublicId);

      await this.prisma.client.category.delete({ where: { id } });
      return successResponse('Category deleted');
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to delete category');
    }
  }
}
