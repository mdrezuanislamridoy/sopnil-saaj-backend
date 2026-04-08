import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiBearerAuth()
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
  @ApiOperation({ summary: 'Get all reviews for a product' })
  getProductReviews(@Param('productId') productId: string) {
    return this.reviewService.getProductReviews(productId);
  }

  @Patch(':reviewId')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update your review' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('reviewId') reviewId: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewService.update(userId, reviewId, dto);
  }

  @Delete(':reviewId')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review (own or admin)' })
  remove(
    @CurrentUser('sub') userId: string,
    @CurrentUser('role') role: string,
    @Param('reviewId') reviewId: string,
  ) {
    return this.reviewService.remove(userId, reviewId, role === UserRole.ADMIN);
  }
}
