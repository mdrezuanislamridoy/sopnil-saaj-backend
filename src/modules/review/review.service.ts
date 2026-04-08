import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  private rethrowOrWrap(error: unknown, fallback: string): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ForbiddenException
    ) throw error;
    throw new InternalServerErrorException(fallback);
  }

  async create(userId: string, productId: string, dto: CreateReviewDto) {
    try {
      const product = await this.prisma.client.product.findUnique({
        where: { id: productId },
      });
      if (!product || !product.isActive) throw new NotFoundException('Product not found');

      const hasPurchased = await this.prisma.client.orderItem.findFirst({
        where: {
          productId,
          order: { userId, status: { in: ['DELIVERED'] } },
        },
      });
      if (!hasPurchased) {
        throw new BadRequestException('You can only review products you have purchased');
      }

      const existing = await this.prisma.client.review.findUnique({
        where: { userId_productId: { userId, productId } },
      });
      if (existing) throw new BadRequestException('You have already reviewed this product');

      const review = await this.prisma.client.review.create({
        data: { userId, productId, rating: dto.rating, comment: dto.comment },
        include: { user: { select: { id: true, name: true, profilePic: true } } },
      });

      return successResponse('Review submitted', review);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to submit review');
    }
  }

  async getProductReviews(productId: string) {
    try {
      const product = await this.prisma.client.product.findUnique({
        where: { id: productId },
      });
      if (!product) throw new NotFoundException('Product not found');

      const reviews = await this.prisma.client.review.findMany({
        where: { productId },
        include: { user: { select: { id: true, name: true, profilePic: true } } },
        orderBy: { createdAt: 'desc' },
      });

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      return successResponse('Reviews fetched', {
        reviews,
        totalReviews: reviews.length,
        averageRating: Math.round(avgRating * 10) / 10,
      });
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to fetch reviews');
    }
  }

  async update(userId: string, reviewId: string, dto: UpdateReviewDto) {
    try {
      const review = await this.prisma.client.review.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new NotFoundException('Review not found');
      if (review.userId !== userId) throw new ForbiddenException('Not your review');

      const updated = await this.prisma.client.review.update({
        where: { id: reviewId },
        data: dto,
        include: { user: { select: { id: true, name: true, profilePic: true } } },
      });

      return successResponse('Review updated', updated);
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to update review');
    }
  }

  async remove(userId: string, reviewId: string, isAdmin: boolean) {
    try {
      const review = await this.prisma.client.review.findUnique({
        where: { id: reviewId },
      });
      if (!review) throw new NotFoundException('Review not found');
      if (!isAdmin && review.userId !== userId) {
        throw new ForbiddenException('Not your review');
      }

      await this.prisma.client.review.delete({ where: { id: reviewId } });
      return successResponse('Review deleted');
    } catch (error) {
      this.rethrowOrWrap(error, 'Failed to delete review');
    }
  }
}
