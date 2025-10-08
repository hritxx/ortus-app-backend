import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Headers,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
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
    @Body() payload: any,
    @Headers("x-razorpay-signature") signature: string
  ) {
    return this.paymentService.handleWebhook(payload, signature);
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
