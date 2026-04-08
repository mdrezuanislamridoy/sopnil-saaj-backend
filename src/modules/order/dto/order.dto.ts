/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentMethod } from 'prisma/generated/prisma/enums';

export class DirectOrderItemDto {
  @ApiProperty({ example: 'product-uuid' })
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ example: 'variant-uuid' })
  @IsUUID()
  @IsNotEmpty()
  variantId!: string;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  shippingName!: string;

  @ApiProperty({ example: '+1234567890' })
  @IsString()
  @IsNotEmpty()
  shippingPhone!: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  shippingAddress!: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  @IsNotEmpty()
  shippingCity!: string;

  @ApiPropertyOptional({ example: '10001' })
  @IsString()
  @IsOptional()
  shippingZip?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: ['cartItemId1', 'cartItemId2'], description: 'Cart item IDs to order from cart' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  cartItemIds?: string[];

  @ApiPropertyOptional({ type: [DirectOrderItemDto], description: 'Direct order items (product, variant, quantity)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DirectOrderItemDto)
  @IsOptional()
  directItems?: DirectOrderItemDto[];

  @ApiProperty({ example: 'CASH_ON_DELIVERY', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ example: 'user@example.com' })
  @IsString()
  @IsOptional()
  customerEmail?: string;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}
