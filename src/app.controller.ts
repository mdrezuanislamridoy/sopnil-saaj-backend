import {
  Controller,
  Get,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
// import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
// import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';
import { ApiOperation } from '@nestjs/swagger';
// import { CloudinaryService } from './config/cloudinary/cloudinary.service';

// interface UploadResponse {
//   success: boolean;
//   message: string;
//   data?: any;
//   error?: string;
// }

// interface MultipleUploadResponse {
//   success: boolean;
//   message: string;
//   totalFiles?: number;
//   uploadedFiles?: Array<{
//     index: number;
//     originalname: string;
//     url?: string;
//     publicId?: string;
//     error?: string;
//   }>;
//   error?: string;
// }

// @ApiTags('Test')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    // private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check' })
  healthCheck(): string {
    return 'OK';
  }

  // @Post('test-upload')
  // @Public()
  // @ApiOperation({ summary: 'Test single file upload to Cloudinary' })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       file: {
  //         type: 'string',
  //         format: 'binary',
  //         description: 'Single image file (max 10MB)',
  //       },
  //     },
  //     required: ['file'],
  //   },
  // })
  // @UseInterceptors(FileInterceptor('file'))
  // async testUpload(@UploadedFile() file?: Express.Multer.File): Promise<UploadResponse> {
  //   try {
  //     console.log('[Test Upload] File received:', {
  //       fieldname: file?.fieldname,
  //       originalname: file?.originalname,
  //       size: file?.size,
  //       mimetype: file?.mimetype,
  //     });

  //     if (!file) {
  //       return {
  //         success: false,
  //         message: 'No file uploaded',
  //       };
  //     }

  //     console.log('[Test Upload] Uploading to Cloudinary...');
  //     const result = await this.cloudinary.uploadFile(file, 'test');

  //     console.log('[Test Upload] Upload successful:', result);
  //     return {
  //       success: true,
  //       message: 'File uploaded successfully',
  //       data: result,
  //     };
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     console.error('[Test Upload] Error:', errorMessage);
  //     return {
  //       success: false,
  //       message: 'Upload failed',
  //       error: errorMessage,
  //     };
  //   }
  // }

  // @Post('test-upload-multiple')
  // @Public()
  // @ApiOperation({ summary: 'Test multiple file upload to Cloudinary' })
  // @ApiConsumes('multipart/form-data')
  // @ApiBody({
  //   schema: {
  //     type: 'object',
  //     properties: {
  //       files: {
  //         type: 'array',
  //         items: {
  //           type: 'string',
  //           format: 'binary',
  //         },
  //         description: 'Multiple image files (max 5 files, 10MB each)',
  //       },
  //     },
  //     required: ['files'],
  //   },
  // })
  // @UseInterceptors(FilesInterceptor('files', 5))
  // async testUploadMultiple(@UploadedFiles() files?: Express.Multer.File[]): Promise<MultipleUploadResponse> {
  //   try {
  //     console.log('[Test Upload Multiple] Files received:', files?.length ?? 0);

  //     if (!files || files.length === 0) {
  //       return {
  //         success: false,
  //         message: 'No files uploaded',
  //       };
  //     }

  //     console.log('[Test Upload Multiple] File details:', files.map(f => ({
  //       fieldname: f.fieldname,
  //       originalname: f.originalname,
  //       size: f.size,
  //       mimetype: f.mimetype,
  //     })));

  //     console.log('[Test Upload Multiple] Uploading to Cloudinary...');
  //     const uploadedFiles: Array<{
  //       index: number;
  //       originalname: string;
  //       url?: string;
  //       publicId?: string;
  //       error?: string;
  //     }> = [];

  //     for (let i = 0; i < files.length; i++) {
  //       try {
  //         console.log(`[Test Upload Multiple] Uploading file ${i + 1}/${files.length}...`);
  //         const result = await this.cloudinary.uploadFile(files[i], 'test');
  //         console.log(`[Test Upload Multiple] File ${i + 1} uploaded:`, result);
  //         uploadedFiles.push({
  //           index: i + 1,
  //           originalname: files[i].originalname,
  //           url: result.url,
  //           publicId: result.publicId,
  //         });
  //       } catch (error) {
  //         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //         console.error(`[Test Upload Multiple] Failed to upload file ${i + 1}:`, errorMessage);
  //         uploadedFiles.push({
  //           index: i + 1,
  //           originalname: files[i].originalname,
  //           error: errorMessage,
  //         });
  //       }
  //     }

  //     console.log('[Test Upload Multiple] All uploads completed');
  //     return {
  //       success: true,
  //       message: 'Files uploaded',
  //       totalFiles: files.length,
  //       uploadedFiles,
  //     };
  //   } catch (error) {
  //     const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  //     console.error('[Test Upload Multiple] Error:', errorMessage);
  //     return {
  //       success: false,
  //       message: 'Upload failed',
  //       error: errorMessage,
  //     };
  // }
  // }
}
