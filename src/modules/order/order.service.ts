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
import { PaymentService } from './payment.service';
import { PaymentMethod } from 'prisma/generated/prisma/enums';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  private rethrowOrWrap(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    )
      throw error;
    throw new InternalServerErrorException(fallback);
  }

  private generateOrderId(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${year}${month}${day}-${timestamp}${random}`;
  }

  async createFromCart(userId: string, dto: CreateOrderDto) {
    try {
      // Validate that either cartItemIds or directItems is provided
      if (!dto.cartItemIds?.length && !dto.directItems?.length) {
        throw new BadRequestException('At least one product need to be ordered');
      }

      if (dto.cartItemIds?.length && dto.directItems?.length) {
        throw new BadRequestException('Cannot use both cartItemIds and directItems');
      }

      let orderItems: Array<{
        productId: string;
        variantId: string;
        quantity: number;
        unitPrice: Decimal;
      }> = [];

      // Handle cart items
      if (dto.cartItemIds?.length) {
        const cartItems = await this.prisma.client.cartItem.findMany({
          where: {
            id: { in: dto.cartItemIds },
            cart: { userId },
          },
          include: { product: true, variant: true },
        });

        if (cartItems.length !== dto.cartItemIds.length) {
          throw new BadRequestException('Some cart items not found');
        }

        orderItems = cartItems.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.variant.price,
        }));
      }

      // Handle direct items
      if (dto.directItems?.length) {
        const variantIds = dto.directItems.map((item) => item.variantId);
        const variants = await this.prisma.client.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: { product: true },
        });

        if (variants.length !== dto.directItems.length) {
          throw new BadRequestException('Some products or variants not found');
        }

        // Check stock availability
        for (const item of dto.directItems) {
          const variant = variants.find((v) => v.id === item.variantId);
          if (!variant) {
            throw new BadRequestException(`Variant ${item.variantId} not found`);
          }
          if (variant.stock < item.quantity) {
            throw new BadRequestException(
              `Insufficient stock for ${variant.product.name}. Available: ${variant.stock}`,
            );
          }
        }

        orderItems = dto.directItems.map((item) => {
          const variant = variants.find((v) => v.id === item.variantId)!;
          return {
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            unitPrice: variant.price,
          };
        });
      }

      // Calculate total amount
      const totalAmount = orderItems.reduce((sum, item) => {
        return sum + Number(item.unitPrice) * item.quantity;
      }, 0);

      // Validate payment method requirements
      if (dto.paymentMethod === PaymentMethod.SSL_COMMERZ && !dto.customerEmail) {
        throw new BadRequestException('Customer email is required for online payment');
      }

      // Create order
      const order = await this.prisma.client.order.create({
        data: {
          id: this.generateOrderId(),
          userId,
          totalAmount: new Decimal(totalAmount),
          shippingName: dto.shippingName,
          shippingPhone: dto.shippingPhone,
          shippingAddress: dto.shippingAddress,
          shippingCity: dto.shippingCity,
          shippingZip: dto.shippingZip,
          notes: dto.notes,
          paymentMethod: dto.paymentMethod,
          items: {
            create: orderItems,
          },
        },
        include: { items: { include: { product: { include: { images: { orderBy: { order: 'asc' } } } }, variant: true } } },
      });

      // Handle payment based on method
      if (dto.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
        // Remove cart items if ordering from cart
        if (dto.cartItemIds?.length) {
          await this.prisma.client.cartItem.deleteMany({
            where: { id: { in: dto.cartItemIds } },
          });
        }

        // Update stock
        if (dto.directItems?.length) {
          for (const item of dto.directItems) {
            await this.prisma.client.productVariant.update({
              where: { id: item.variantId },
              data: { stock: { decrement: item.quantity } },
            });
          }
        }

        return successResponse('Order placed successfully', order);
      } else if (dto.paymentMethod === PaymentMethod.SSL_COMMERZ) {
        // Initiate online payment
        const paymentData = await this.paymentService.initiateSslCommerzPayment({
          orderId: order.id,
          amount: totalAmount,
          customerName: dto.shippingName,
          customerEmail: dto.customerEmail!,
          customerPhone: dto.shippingPhone,
          customerAddress: dto.shippingAddress,
        });

        return successResponse('Payment initiated', {
          order,
          paymentUrl: paymentData.paymentUrl,
        });
      }

      throw new BadRequestException('Invalid payment method');
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to place order');
    }
  }

  async getMyOrders(userId: string) {
    try {
      const orders = await this.prisma.client.order.findMany({
        where: { userId },
        include: { items: { include: { product: { include: { images: { orderBy: { order: 'asc' } } } }, variant: true } } },
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
        include: { items: { include: { product: { include: { images: { orderBy: { order: 'asc' } } } }, variant: true } } },
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
          items: { include: { product: { include: { images: { orderBy: { order: 'asc' } } } }, variant: true } },
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

  async handlePaymentSuccess(orderId: string, transactionId: string) {
    try {
      const isValid = await this.paymentService.verifyPayment(transactionId);
      if (!isValid) {
        throw new BadRequestException('Invalid payment');
      }

      const order = await this.prisma.client.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) throw new NotFoundException('Order not found');

      // Update order status to confirmed
      await this.prisma.client.order.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED' },
      });

      // Update stock
      for (const item of order.items) {
        await this.prisma.client.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return successResponse('Payment successful', order);
    } catch (error) {
      this.rethrowOrWrap(error, 'Payment processing failed');
    }
  }

  async handlePaymentFailure(orderId: string) {
    try {
      const order = await this.prisma.client.order.findUnique({
        where: { id: orderId },
      });

      if (!order) throw new NotFoundException('Order not found');

      await this.prisma.client.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });

      return successResponse('Payment failed, order cancelled', null);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to handle payment failure');
    }
  }

  async cancelOrder(userId: string, orderId: string) {
    try {
      const order = await this.prisma.client.order.findFirst({
        where: { id: orderId, userId },
      });
      if (!order) throw new NotFoundException('Order not found');

      if (order.status !== 'PENDING') {
        throw new BadRequestException('Only PENDING orders can be cancelled');
      }

      const updated = await this.prisma.client.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
      });
      return successResponse('Order cancelled successfully', updated);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to cancel order');
    }
  }
}
