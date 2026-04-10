import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'prisma/generated/prisma/enums';

@ApiTags('Review')
@Controller('products/:productId/reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Submit a review (must have purchased the product)' })
  create(
    @CurrentUser('sub') userId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewService.create(userId, productId, dto);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all reviews for a product with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5 })
  getProductReviews(
    @Param('productId') productId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.reviewService.getProductReviews(productId, pageNum, limitNum);
  }

  @Patch(':reviewId')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Update your review' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.update(userId, reviewId, dto);
  }

  @Delete(':reviewId')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Delete a review (own or admin)' })
  remove(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviewService.remove(userId, reviewId, role === UserRole.ADMIN);
  }
}
