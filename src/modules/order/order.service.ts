import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { Decimal } from '@prisma/client/runtime/index-browser';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowOrWrap(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    )
      throw error;
    throw new InternalServerErrorException(fallback);
  }

  async createFromCart(userId: string, dto: CreateOrderDto) {
    try {
      const cart = await this.prisma.client.cart.findUnique({
        where: { userId },
        include: { items: { include: { product: true, variant: true } } },
      });

      if (!cart || cart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      const totalAmount = cart.items.reduce((sum, item) => {
        return sum + Number(item.variant.price) * item.quantity;
      }, 0);

      const order = await this.prisma.client.order.create({
        data: {
          userId,
          totalAmount: new Decimal(totalAmount),
          shippingName: dto.shippingName,
          shippingPhone: dto.shippingPhone,
          shippingAddress: dto.shippingAddress,
          shippingCity: dto.shippingCity,
          shippingZip: dto.shippingZip,
          notes: dto.notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              unitPrice: item.variant.price,
            })),
          },
        },
        include: { items: { include: { product: true, variant: true } } },
      });

      await this.prisma.client.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return successResponse('Order placed successfully', order);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to place order');
    }
  }

  async getMyOrders(userId: string) {
    try {
      const orders = await this.prisma.client.order.findMany({
        where: { userId },
        include: { items: { include: { product: true, variant: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return successResponse('Orders fetched', orders);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch orders');
    }
  }

  async getOrderById(userId: string, orderId: string) {
    try {
      const order = await this.prisma.client.order.findFirst({
        where: { id: orderId, userId },
        include: { items: { include: { product: true, variant: true } } },
      });
      if (!order) throw new NotFoundException('Order not found');
      return successResponse('Order fetched', order);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch order');
    }
  }

  async getAllOrders() {
    try {
      const orders = await this.prisma.client.order.findMany({
        include: {
          items: { include: { product: true, variant: true } },
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return successResponse('All orders fetched', orders);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch all orders');
    }
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    try {
      const order = await this.prisma.client.order.findUnique({
        where: { id: orderId },
      });
      if (!order) throw new NotFoundException('Order not found');

      const updated = await this.prisma.client.order.update({
        where: { id: orderId },
        data: { status: dto.status },
      });
      return successResponse('Order status updated', updated);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to update order status');
    }
  }
}
