/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AddToWishlistDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  productId!: string;
}
