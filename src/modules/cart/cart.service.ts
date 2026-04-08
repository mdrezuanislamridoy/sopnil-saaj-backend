import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowOrWrap(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) throw error;
    throw new InternalServerErrorException(fallback);
  }

  private async getOrCreateCart(userId: string) {
    return this.prisma.client.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      include: { items: { include: { product: true, variant: true } } },
    });
  }

  async getCart(userId: string) {
    try {
      const cart = await this.getOrCreateCart(userId);
      return successResponse('Cart fetched', cart);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch cart');
    }
  }

  async addItem(userId: string, dto: AddToCartDto) {
    try {
      const product = await this.prisma.client.product.findUnique({
        where: { id: dto.productId },
      });
      if (!product || !product.isActive) throw new NotFoundException('Product not found');

      const variant = await this.prisma.client.productVariant.findFirst({
        where: { id: dto.variantId, productId: dto.productId },
      });
      if (!variant) throw new NotFoundException('Variant not found');

      const cart = await this.getOrCreateCart(userId);

      const existing = await this.prisma.client.cartItem.findUnique({
        where: { cartId_variantId: { cartId: cart.id, variantId: dto.variantId } },
      });

      if (existing) {
        await this.prisma.client.cartItem.update({
          where: { id: existing.id },
          data: { quantity: existing.quantity + (dto.quantity ?? 1) },
        });
      } else {
        await this.prisma.client.cartItem.create({
          data: { cartId: cart.id, productId: dto.productId, variantId: dto.variantId, quantity: dto.quantity ?? 1 },
        });
      }

      return this.getCart(userId);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to add item to cart');
    }
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    try {
      const cart = await this.prisma.client.cart.findUnique({ where: { userId } });
      if (!cart) throw new NotFoundException('Cart not found');

      const item = await this.prisma.client.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
      });
      if (!item) throw new NotFoundException('Cart item not found');

      await this.prisma.client.cartItem.update({
        where: { id: itemId },
        data: { quantity: dto.quantity },
      });

      return this.getCart(userId);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to update cart item');
    }
  }

  async removeItem(userId: string, itemId: string) {
    try {
      const cart = await this.prisma.client.cart.findUnique({ where: { userId } });
      if (!cart) throw new NotFoundException('Cart not found');

      const item = await this.prisma.client.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id },
      });
      if (!item) throw new NotFoundException('Cart item not found');

      await this.prisma.client.cartItem.delete({ where: { id: itemId } });
      return this.getCart(userId);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to remove cart item');
    }
  }

  async clearCart(userId: string) {
    try {
      const cart = await this.prisma.client.cart.findUnique({ where: { userId } });
      if (cart) {
        await this.prisma.client.cartItem.deleteMany({ where: { cartId: cart.id } });
      }
      return successResponse('Cart cleared');
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to clear cart');
    }
  }
}
