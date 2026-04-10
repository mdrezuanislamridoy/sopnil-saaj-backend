import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    try {
      const [
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue,
        recentOrders,
      ] = await Promise.all([
        this.prisma.client.user.count({
          where: { isDeleted: false, role: 'USER' },
        }),
        this.prisma.client.order.count(),
        this.prisma.client.product.count({ where: { isActive: true } }),
        this.prisma.client.order.aggregate({
          where: { status: 'DELIVERED' },
          _sum: { totalAmount: true },
        }),
        this.prisma.client.order.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        }),
      ]);

      const stats = {
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        recentOrders,
      };

      return successResponse('Dashboard stats fetched', stats);
    } catch (error) {
      handlePrismaError(error, 'Failed to fetch dashboard stats');
    }
  }
}
