import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
} from "@nestjs/common";
import type { Request as ExpressRequest } from "express";
import { PaymentService } from "./payment.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  CreateOrderDto,
  VerifyPaymentDto,
  RefundPaymentDto,
} from "./dto/payment.dto";

@Controller("payment")
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Get("config")
  @UseGuards(JwtAuthGuard)
  async getPaymentConfig() {
    return this.paymentService.getPaymentConfig();
  }

  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.paymentService.createOrder(req.user.id, createOrderDto);
  }

  @Post("verify")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @Request() req,
    @Body() verifyPaymentDto: VerifyPaymentDto
  ) {
    return this.paymentService.verifyPayment(req.user.id, verifyPaymentDto);
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Body() payload: any,
    @Headers("x-razorpay-signature") signature: string
  ) {
    const rawBody = req.rawBody?.toString("utf8") ?? "";
    return this.paymentService.handleRazorpayWebhook(rawBody, payload, signature);
  }

  @Post("cashfree-webhook")
  @HttpCode(HttpStatus.OK)
  async handleCashfreeWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Body() payload: any,
    @Headers("x-webhook-signature") signature: string,
    @Headers("x-webhook-timestamp") timestamp: string
  ) {
    const rawBody = req.rawBody?.toString("utf8") ?? "";
    return this.paymentService.handleCashfreeWebhook(rawBody, payload, signature, timestamp);
  }

  @Post("refund")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refundPayment(
    @Request() req,
    @Body() refundPaymentDto: RefundPaymentDto
  ) {
    return this.paymentService.refundPayment(req.user.id, refundPaymentDto);
  }

  @Get("details/:paymentId")
  @UseGuards(JwtAuthGuard)
  async getPaymentDetails(@Param("paymentId") paymentId: string) {
    return this.paymentService.getPaymentDetails(paymentId);
  }
}
