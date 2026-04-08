import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { PaymentService } from './payment.service';

@Module({
  controllers: [OrderController],
  providers: [OrderService, PaymentService],
})
export class OrderModule {}
