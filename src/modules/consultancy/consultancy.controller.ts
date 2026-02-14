import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ConsultancyService } from "./consultancy.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SubscribeDto, BookSessionDto, VerifyPaymentDto } from "./dto";

@Controller("consultancy")
export class ConsultancyController {
  constructor(private consultancyService: ConsultancyService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getServices(@Request() req, @Query("type") type?: string) {
    return this.consultancyService.getServices(req.user.id, type);
  }

  @Get("subscriptions")
  @UseGuards(JwtAuthGuard)
  async getUserSubscriptions(@Request() req, @Query("status") status?: string) {
    return this.consultancyService.getUserSubscriptions(req.user.id, status);
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getUserSessions(@Request() req, @Query("status") status?: string) {
    return this.consultancyService.getUserSessions(req.user.id, status);
  }

  @Get("sessions/:sessionId")
  @UseGuards(JwtAuthGuard)
  async getSessionById(
    @Request() req,
    @Param("sessionId") sessionId: string
  ) {
    return this.consultancyService.getSessionById(req.user.id, sessionId);
  }

  @Delete("sessions/:sessionId")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelSession(
    @Request() req,
    @Param("sessionId") sessionId: string
  ) {
    return this.consultancyService.cancelSession(req.user.id, sessionId);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getServiceById(@Request() req, @Param("id") serviceId: string) {
    return this.consultancyService.getServiceById(serviceId, req.user.id);
  }

  @Get(":id/subscription-status")
  @UseGuards(JwtAuthGuard)
  async getSubscriptionStatus(@Request() req, @Param("id") serviceId: string) {
    return this.consultancyService.getSubscriptionStatus(req.user.id, serviceId);
  }

  @Post(":id/subscribe")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Request() req,
    @Param("id") serviceId: string,
    @Body() subscribeDto: SubscribeDto
  ) {
    return this.consultancyService.subscribe(req.user.id, serviceId, subscribeDto);
  }

  @Post(":id/verify-payment")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Request() req,
    @Param("id") serviceId: string,
    @Body() verifyPaymentDto: VerifyPaymentDto
  ) {
    return this.consultancyService.verifyPayment(
      req.user.id,
      serviceId,
      verifyPaymentDto
    );
  }

  @Get(":id/slots")
  @UseGuards(JwtAuthGuard)
  async getAvailableSlots(
    @Param("id") serviceId: string,
    @Query("date") date: string
  ) {
    return this.consultancyService.getAvailableSlots(serviceId, date);
  }

  @Post(":id/book-session")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async bookSession(
    @Request() req,
    @Param("id") serviceId: string,
    @Body() bookSessionDto: BookSessionDto
  ) {
    return this.consultancyService.bookSession(
      req.user.id,
      serviceId,
      bookSessionDto
    );
  }
}
