/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Expose, Transform, Type, plainToInstance } from 'class-transformer';

export class ProductVariantDto {
  @ApiProperty({ example: 'M' })
  @Expose()
  @IsString()
  @IsNotEmpty()
  size!: string;

  @ApiProperty({ example: 29.99 })
  @Expose()
  @Type(() => Number)
  @IsNumber()
  price!: number;

  @ApiPropertyOptional({ example: 39.99 })
  @Expose()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  comparePrice?: number;

  @ApiPropertyOptional({ example: 'Red' })
  @Expose()
  @IsString()
  @IsOptional()
  color?: string;

  @ApiPropertyOptional({ example: 100 })
  @Expose()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  stock?: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Classic T-Shirt' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'classic-t-shirt' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'SKU-001' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({ example: false })
  @Transform(({ value }) => {
    console.log('isFeatured raw value:', value, 'type:', typeof value);
    if (value === 'true' || value === true || value === '1' || value === 1)
      return true;
    if (value === 'false' || value === false || value === '0' || value === 0)
      return false;
    if (value === undefined || value === null || value === '') return undefined;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;

  @ApiProperty({ example: 'uuid-of-category' })
  @IsUUID()
  categoryId!: string;

  @ApiProperty({ type: [ProductVariantDto] })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        const decoded = value.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) {
          return plainToInstance(ProductVariantDto, parsed, {
            excludeExtraneousValues: false,
          });
        }
        return parsed;
      } catch (e) {
        console.error('Variants parsing error:', e);
        return value;
      }
    }
    return value;
  })
  @Type(() => ProductVariantDto)
  @IsArray()
  @ValidateNested({ each: true })
  variants!: ProductVariantDto[];
}

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @ApiPropertyOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === '1' || value === 1)
      return true;
    if (value === 'false' || value === false || value === '0' || value === 0)
      return false;
    return value;
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Image IDs to remove' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    return value;
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removeImageIds?: string[];
}
