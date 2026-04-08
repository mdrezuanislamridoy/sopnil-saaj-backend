import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
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
  @ApiBearerAuth()
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
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'), LogBodyInterceptor)
  create(
    @Body() dto: CreateProductDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.productService.create(dto, image);
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get all active products' })
  @ApiQuery({ name: 'featured', required: false, type: Boolean })
  findAll(@Query('featured') featured?: string) {
    const isFeatured = featured === 'true' ? true : featured === 'false' ? false : undefined;
    return this.productService.findAll(isFeatured);
  }

  @Public()
  @Get('category/:categoryId')
  @ApiOperation({ summary: 'Get products by category' })
  findByCategory(@Param('categoryId') categoryId: string) {
    return this.productService.findByCategory(categoryId);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product by id' })
  findOne(@Param('id') id: string) {
    return this.productService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
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
        image: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('image'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.productService.update(id, dto, image);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product (Admin)' })
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
