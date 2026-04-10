import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllUsers(search?: string) {
    try {
      const where: any = { isDeleted: false };
      
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ];
      }

      const users = await this.prisma.client.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accountType: true,
          isEmailVerified: true,
          isBlocked: true,
          createdAt: true,
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse('Users fetched successfully', users);
    } catch (error) {
      handlePrismaError(error, 'Failed to fetch users');
    }
  }

  async getUserById(id: string) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          accountType: true,
          isEmailVerified: true,
          isBlocked: true,
          isDeleted: true,
          profilePic: true,
          createdAt: true,
          updatedAt: true,
          orders: {
            select: {
              id: true,
              totalAmount: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!user) throw new NotFoundException('User not found');

      return successResponse('User fetched', user);
    } catch (error) {
      handlePrismaError(error, 'Failed to fetch user');
    }
  }

  async toggleBlockUser(userId: string) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id: userId },
      });

      if (!user) throw new NotFoundException('User not found');

      if (user.role === 'ADMIN') {
        throw new BadRequestException('Cannot block an administrator account');
      }

      const updatedUser = await this.prisma.client.user.update({
        where: { id: userId },
        data: {
          isBlocked: !user.isBlocked,
          ...(!user.isBlocked ? { refreshToken: null } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          isBlocked: true,
        },
      });

      const message = updatedUser.isBlocked
        ? 'User has been blocked'
        : 'User has been unblocked';
      return successResponse(message, updatedUser);
    } catch (error) {
      handlePrismaError(error, 'Failed to update user status');
    }
  }

  async deleteUser(id: string) {
    try {
      const user = await this.prisma.client.user.findUnique({
        where: { id },
      });

      if (!user) throw new NotFoundException('User not found');

      if (user.role === 'ADMIN') {
        throw new BadRequestException('Cannot delete an administrator account');
      }

      await this.prisma.client.user.update({
        where: { id },
        data: { isDeleted: true, refreshToken: null },
      });

      return successResponse('User deleted successfully');
    } catch (error) {
      handlePrismaError(error, 'Failed to delete user');
    }
  }
}
