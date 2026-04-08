import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { FilterProductDto } from './dto/filter-product.dto';
import { LogBodyInterceptor } from './log-body.interceptor';
import { Public } from 'src/common/decorators/public.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'prisma/generated/prisma/enums';

@ApiTags('Product')
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create product (Admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'categoryId', 'variants'],
      properties: {
        name: { type: 'string', example: 'Classic T-Shirt' },
        slug: { type: 'string', example: 'classic-t-shirt' },
        description: { type: 'string' },
        sku: { type: 'string', example: 'SKU-001' },
        isFeatured: { type: 'boolean', example: false },
        categoryId: { type: 'string', example: 'uuid-of-category' },
        variants: {
          type: 'string',
          example: '[{"size":"S","price":29.99,"comparePrice":39.99,"stock":50}]',
          description: 'JSON string of variants array',
        },
        images: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'Multiple product images (max 5)'
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('images', 5), LogBodyInterceptor)
  create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.productService.create(dto, images);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active products with filters and sorting' })
  findAll(@Query() filters: FilterProductDto) {
    return this.productService.findAll(filters);
  }



  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update product (Admin)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        sku: { type: 'string' },
        isFeatured: { type: 'boolean' },
        isActive: { type: 'boolean' },
        categoryId: { type: 'string' },
        variants: {
          type: 'string',
          example: '[{"size":"S","price":29.99,"comparePrice":39.99,"stock":50}]',
          description: 'JSON string of variants array — replaces all existing variants',
        },
        images: { 
          type: 'array', 
          items: { type: 'string', format: 'binary' },
          description: 'New images to add (max 5 total)'
        },
        removeImageIds: {
          type: 'string',
          example: '["image-id-1", "image-id-2"]',
          description: 'JSON array of image IDs to remove'
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('images', 5))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.productService.update(id, dto, images);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete product (Admin)' })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
