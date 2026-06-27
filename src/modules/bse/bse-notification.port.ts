// Port the BseService depends on for user-facing push notifications, so the
// service stays decoupled from the concrete FCM/notification implementation
// (and is trivially mockable in unit tests). Implemented by BseNotificationAdapter.
export const NOTIFICATION_PORT = Symbol("BSE_NOTIFICATION_PORT");

export interface NotificationMessage {
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface NotificationPort {
  pushToUser(userId: string, msg: NotificationMessage): Promise<boolean>;
}
