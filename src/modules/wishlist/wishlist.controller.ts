import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/wishlist.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'prisma/generated/prisma/enums';

@ApiTags('Wishlist')
@Controller('wishlists')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) { }

  @Get()
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current user wishlist' })
  getWishlist(@CurrentUser('sub') userId: string) {
    return this.wishlistService.getWishlist(userId);
  }

  @Post('items')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Add product to wishlist' })
  addItem(@CurrentUser('sub') userId: string, @Body() dto: AddToWishlistDto) {
    return this.wishlistService.addItem(userId, dto);
  }

  @Delete('items/:itemId')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove product from wishlist' })
  removeItem(@CurrentUser('sub') userId: string, @Param('itemId') itemId: string) {
    return this.wishlistService.removeItem(userId, itemId);
  }
}
