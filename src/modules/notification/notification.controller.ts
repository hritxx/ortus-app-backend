import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { NotificationService } from "./notification.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Get()
  async getUserNotifications(
    @Request() req,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.notificationService.getUserNotifications(
      req.user.id,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
  }

  @Get("unread-count")
  async getUnreadCount(@Request() req) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  @Get(":id")
  async getNotificationById(@Request() req, @Param("id") id: string) {
    return this.notificationService.getNotificationById(id, req.user.id);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Request() req, @Param("id") id: string) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  @Patch("read-all")
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async deleteNotification(@Request() req, @Param("id") id: string) {
    return this.notificationService.deleteNotification(id, req.user.id);
  }
}
