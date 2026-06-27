import { Injectable } from "@nestjs/common";
import { NotificationType, NotificationCategory } from "@prisma/client";
import { NotificationService } from "../notification/notification.service";
import { NotificationPort, NotificationMessage } from "./bse-notification.port";

// Adapts the BSE NotificationPort onto the app's existing NotificationService,
// which persists the notification AND pushes to all of the user's active
// devices via FCM (firebase-admin). Reusing it keeps device lookup + FCM
// delivery in one place rather than duplicating it here.
@Injectable()
export class BseNotificationAdapter implements NotificationPort {
  constructor(private readonly notifications: NotificationService) {}

  async pushToUser(userId: string, msg: NotificationMessage): Promise<boolean> {
    await this.notifications.createNotification({
      userId,
      title: msg.title,
      body: msg.body,
      type: NotificationType.INFO,
      category: NotificationCategory.INVESTMENT,
      data: msg.data,
    });
    return true;
  }
}
