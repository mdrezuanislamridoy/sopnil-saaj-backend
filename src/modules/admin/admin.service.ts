import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { successResponse } from 'src/common/response';
import { handlePrismaError } from 'src/common/utils/prisma-error-handler';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    try {
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

      const [
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue,
        recentOrders,
        allOrders,
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
        // Get all orders from last 7 months
        this.prisma.client.order.findMany({
          where: {
            createdAt: { gte: sixMonthsAgo },
          },
          select: {
            createdAt: true,
            totalAmount: true,
            status: true,
          },
        }),
      ]);

      // Process monthly data
      const revenueByMonth = this.processMonthlyData(allOrders, 'revenue');
      const ordersByMonth = this.processMonthlyData(allOrders, 'orders');

      const stats = {
        totalUsers,
        totalOrders,
        totalProducts,
        totalRevenue: Number(totalRevenue._sum.totalAmount || 0),
        recentOrders,
        monthlyRevenue: revenueByMonth,
        monthlyOrders: ordersByMonth,
      };

      return successResponse('Dashboard stats fetched', stats);
    } catch (error) {
      handlePrismaError(error, 'Failed to fetch dashboard stats');
    }
  }

  private processMonthlyData(
    data: any[],
    type: 'revenue' | 'orders',
  ): Array<{ month: string; revenue?: number; orders?: number }> {
    const now = new Date();
    const months: Array<{ month: string; value: number; key: string }> = [];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Generate last 7 months
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      months.push({
        month: monthNames[date.getMonth()],
        value: 0,
        key: monthKey,
      });
    }

    // Fill in actual data
    data.forEach((item) => {
      const date = new Date(item.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthData = months.find((m) => m.key === monthKey);

      if (monthData) {
        if (type === 'revenue') {
          // Only count delivered orders for revenue
          if (item.status === 'DELIVERED') {
            monthData.value += Number(item.totalAmount || 0);
          }
        } else {
          // Count all orders
          monthData.value += 1;
        }
      }
    });

    return months.map((m) => ({
      month: m.month,
      [type]: m.value,
    }));
  }
}
