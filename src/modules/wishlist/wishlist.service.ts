import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { AddToWishlistDto } from './dto/wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowOrWrap(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) throw error;
    throw new InternalServerErrorException(fallback);
  }

  private async getOrCreateWishlist(userId: string) {
    return this.prisma.client.wishlist.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: { product: { include: { images: { orderBy: { order: 'asc' } } } } } } },
    });
  }

  async getWishlist(userId: string) {
    try {
      const wishlist = await this.getOrCreateWishlist(userId);
      return successResponse('Wishlist fetched', wishlist);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch wishlist');
    }
  }

  async addItem(userId: string, dto: AddToWishlistDto) {
    try {
      const product = await this.prisma.client.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product || !product.isActive) throw new NotFoundException('Product not found');

      const wishlist = await this.getOrCreateWishlist(userId);

      const existing = await this.prisma.client.wishlistItem.findUnique({
        where: {
          wishlistId_productId: { wishlistId: wishlist.id, productId: dto.productId },
        },
      });
      if (existing) throw new BadRequestException('Product already in wishlist');

      await this.prisma.client.wishlistItem.create({
        data: { wishlistId: wishlist.id, productId: dto.productId },
      });

      return this.getWishlist(userId);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to add item to wishlist');
    }
  }

  async removeItem(userId: string, itemId: string) {
    try {
      const wishlist = await this.prisma.client.wishlist.findUnique({ where: { userId } });
      if (!wishlist) throw new NotFoundException('Wishlist not found');

      const item = await this.prisma.client.wishlistItem.findFirst({
        where: { id: itemId, wishlistId: wishlist.id },
      });
      if (!item) throw new NotFoundException('Wishlist item not found');

      await this.prisma.client.wishlistItem.delete({ where: { id: itemId } });
      return this.getWishlist(userId);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to remove wishlist item');
    }
  }
}
