import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'prisma/generated/prisma/enums';

@ApiTags('Order')
@Controller('orders')
@ApiBearerAuth()
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Place order from cart' })
  createFromCart(@CurrentUser('sub') userId: string, @Body() dto: CreateOrderDto) {
    return this.orderService.createFromCart(userId, dto);
  }

  @Get('my')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get my orders' })
  getMyOrders(@CurrentUser('sub') userId: string) {
    return this.orderService.getMyOrders(userId);
  }

  @Get('my/:orderId')
  @Roles(UserRole.USER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get my order by id' })
  getOrderById(@CurrentUser('sub') userId: string, @Param('orderId') orderId: string) {
    return this.orderService.getOrderById(userId, orderId);
  }

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all orders (Admin)' })
  getAllOrders() {
    return this.orderService.getAllOrders();
  }

  @Patch('admin/:orderId/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update order status (Admin)' })
  updateStatus(@Param('orderId') orderId: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orderService.updateStatus(orderId, dto);
  }
}
