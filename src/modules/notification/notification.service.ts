import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FirebaseService } from "../../common/services/firebase.service";

@Injectable()
export class NotificationService {
  constructor(
    private prisma: PrismaService,
    private firebaseService: FirebaseService
  ) {}

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      success: true,
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getNotificationById(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return {
      success: true,
      notification,
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    const updatedNotification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return {
      success: true,
      message: "Notification marked as read",
      notification: updatedNotification,
    };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      success: true,
      message: "All notifications marked as read",
    };
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return {
      success: true,
      message: "Notification deleted successfully",
    };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return {
      success: true,
      unreadCount: count,
    };
  }

  async createNotification(data: {
    userId: string;
    title: string;
    body: string;
    type: any;
    category: any;
    data?: any;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        type: data.type,
        category: data.category,
        data: data.data,
      },
    });

    // Fetch user's registered devices and send push notification
    try {
      const devices = await this.prisma.device.findMany({
        where: { userId: data.userId, isActive: true },
        select: { deviceToken: true },
      });

      const tokens = devices.map((d) => d.deviceToken).filter(Boolean);

      if (tokens.length > 0) {
        const payloadData: Record<string, string> = {
          type: String(data.type),
          category: String(data.category),
        };

        if (data.data) {
          payloadData.details = JSON.stringify(data.data);
        }

        const success = await this.firebaseService.sendPushNotification(
          tokens,
          data.title,
          data.body,
          payloadData
        );

        if (success) {
          await this.prisma.notification.update({
            where: { id: notification.id },
            data: {
              isPushSent: true,
              pushSentAt: new Date(),
            },
          });
        }
      }
    } catch (pushError) {
      // Robust error handling to make sure failing pushes do not crash the app transactions
      console.error("[NotificationService] Push notification dispatch failed:", pushError);
    }

    return {
      success: true,
      notification,
    };
  }
}
