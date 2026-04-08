import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'prisma/generated/prisma/enums';

@ApiTags('Cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Get current user cart' })
  getCart(@CurrentUser('sub') userId: string) {
    return this.cartService.getCart(userId);
  }

  @Post('items')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Add item to cart' })
  addItem(@CurrentUser('sub') userId: string, @Body() dto: AddToCartDto) {
    return this.cartService.addItem(userId, dto);
  }

  @Patch('items/:itemId')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Update cart item quantity' })
  updateItem(
    @CurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(userId, itemId, dto);
  }

  @Delete('items/:itemId')
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Remove item from cart' })
  removeItem(@CurrentUser('sub') userId: string, @Param('itemId') itemId: string) {
    return this.cartService.removeItem(userId, itemId);
  }

  @Delete()
  @Roles(UserRole.USER)
  @ApiOperation({ summary: 'Clear cart' })
  clearCart(@CurrentUser('sub') userId: string) {
    return this.cartService.clearCart(userId);
  }

  @Get('all-cart-items')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all cart items' })
  getAllCartItems() {
    // return this.cartService.getAllCartItems();
  }
}
