import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export function handlePrismaError(error: unknown, fallback: string): never {
  console.error('Service error:', error);

  if (
    error instanceof BadRequestException ||
    error instanceof NotFoundException ||
    error instanceof InternalServerErrorException
  ) {
    throw error;
  }

  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as {
      code: string;
      meta?: { target?: string[]; cause?: string };
    };

    switch (prismaError.code) {
      case 'P2002':
        const field = prismaError.meta?.target?.[0] || 'field';
        throw new BadRequestException(
          `A record with this ${field} already exists. Please use a different ${field}.`,
        );

      case 'P2025':
        throw new NotFoundException('Record not found');

      case 'P2003':
        throw new BadRequestException('Invalid reference to related record');

      case 'P2022':
        throw new InternalServerErrorException(
          'Database schema mismatch. Please contact support.',
        );

      case 'P2014':
        throw new BadRequestException('Related record is required');

      case 'P2016':
        throw new BadRequestException('Invalid query parameters');

      default:
        console.error('Unhandled Prisma error code:', prismaError.code);
    }
  }

  throw new InternalServerErrorException(fallback);
}
