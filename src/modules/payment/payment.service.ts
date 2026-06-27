import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import * as crypto from "crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  CreateOrderDto,
  VerifyPaymentDto,
  RefundPaymentDto,
} from "./dto/payment.dto";
import { RazorpayGateway } from "./gateways/razorpay.gateway";
import { CashfreeGateway } from "./gateways/cashfree.gateway";
import { PaymentGateway } from "./payment-gateway.interface";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private razorpayGateway: RazorpayGateway,
    private cashfreeGateway: CashfreeGateway
  ) {}

  getGateway(): PaymentGateway {
    const provider = this.configService.get<string>("PAYMENT_GATEWAY") || "CASHFREE";
    if (provider.toUpperCase() === "RAZORPAY") {
      return this.razorpayGateway;
    }
    return this.cashfreeGateway;
  }

  getGatewayName(): 'CASHFREE' | 'RAZORPAY' {
    const provider = this.configService.get<string>("PAYMENT_GATEWAY") || "CASHFREE";
    return provider.toUpperCase() === "RAZORPAY" ? "RAZORPAY" : "CASHFREE";
  }

  async getPaymentConfig() {
    const provider = this.getGatewayName();
    const isProd = this.configService.get<string>("CASHFREE_ENV") === "PROD";
    const env = isProd ? "production" : "sandbox";
    
    if (provider === "RAZORPAY") {
      return {
        provider,
        publicKey: this.configService.get<string>("RAZORPAY_KEY_ID"),
        environment: this.configService.get<string>("NODE_ENV") || "development",
      };
    }

    return {
      provider,
      publicKey: this.configService.get<string>("CASHFREE_APP_ID"),
      environment: env,
    };
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    const gateway = this.getGateway();
    return gateway.createOrder(userId, createOrderDto);
  }

  async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto) {
    const gateway = this.getGateway();
    const result = await gateway.verifyPayment(userId, verifyPaymentDto);

    // After verification, update the transaction if found in the database
    const orderId = verifyPaymentDto.orderId || verifyPaymentDto.razorpayOrderId;
    const paymentId = verifyPaymentDto.razorpayPaymentId || result.paymentId;

    if (result.verified) {
      await this.handlePaymentCaptured(paymentId, orderId, this.getGatewayName());
    } else {
      await this.handlePaymentFailed(paymentId || orderId, this.getGatewayName());
    }

    return result;
  }

  async refundPayment(userId: string, refundPaymentDto: RefundPaymentDto) {
    const gateway = this.getGateway();
    const result = await gateway.refundPayment(userId, refundPaymentDto);

    // Update transaction status in DB for refund
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { pgPaymentId: refundPaymentDto.paymentId },
          { pgOrderId: refundPaymentDto.paymentId },
          { razorpayPaymentId: refundPaymentDto.paymentId },
          { razorpayOrderId: refundPaymentDto.paymentId }
        ]
      },
    });

    if (transaction) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "REFUNDED",
        },
      });
    }

    return result;
  }

  async getPaymentDetails(paymentId: string) {
    const gateway = this.getGateway();
    return gateway.getPaymentDetails(paymentId);
  }

  /** Constant-time signature comparison. */
  private safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  }

  async handleWebhook(rawBody: string, payload: any, signature: string) {
    // Delegate to Razorpay webhook by default or read event structures to route
    if (payload?.event && payload?.payload?.payment) {
      return this.handleRazorpayWebhook(rawBody, payload, signature);
    }
    return this.handleCashfreeWebhook(rawBody, payload, signature, "");
  }

  // razorpay webhook — signature is HMAC-SHA256 (hex) over the RAW request body
  async handleRazorpayWebhook(rawBody: string, payload: any, signature: string) {
    try {
      const webhookSecret =
        this.configService.get<string>("RAZORPAY_WEBHOOK_SECRET") || "";

      const generatedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");

      if (!signature || !this.safeEqual(generatedSignature, signature)) {
        this.logger.warn("Invalid Razorpay webhook signature — rejected");
        throw new UnauthorizedException("Invalid webhook signature");
      }

      const event = payload.event;
      const paymentEntity = payload.payload.payment.entity;

      this.logger.log(`Razorpay Webhook: ${event} for payment: ${paymentEntity.id}`);

      if (event === "payment.captured") {
        await this.handlePaymentCaptured(paymentEntity.id, paymentEntity.order_id, "RAZORPAY");
      } else if (event === "payment.failed") {
        await this.handlePaymentFailed(paymentEntity.id, "RAZORPAY");
      }

      return { success: true };
    } catch (error) {
      this.logger.error("Razorpay webhook error:", error);
      throw error;
    }
  }

  // cashfree webhook — signature is HMAC-SHA256 (base64) over (timestamp + RAW body)
  async handleCashfreeWebhook(
    rawBody: string,
    payload: any,
    signature: string,
    timestamp: string
  ) {
    try {
      const secretKey =
        this.configService.get<string>("CASHFREE_SECRET_KEY") || "";

      if (!signature || !timestamp) {
        this.logger.warn("Cashfree webhook missing signature/timestamp — rejected");
        throw new UnauthorizedException("Missing webhook signature");
      }

      const computedSignature = crypto
        .createHmac("sha256", secretKey)
        .update(timestamp + rawBody)
        .digest("base64");

      if (!this.safeEqual(computedSignature, signature)) {
        this.logger.warn("Cashfree webhook signature mismatch — rejected");
        throw new UnauthorizedException("Invalid webhook signature");
      }

      const { data } = payload;
      if (!data || !data.order || !data.payment) {
        this.logger.warn("Invalid Cashfree webhook payload structure");
        return { success: false };
      }

      const orderId = data.order.order_id;
      const paymentId = data.payment.cf_payment_id;
      const paymentStatus = data.payment.payment_status;

      this.logger.log(`Cashfree Webhook: status ${paymentStatus} for order: ${orderId}`);

      if (paymentStatus === "SUCCESS") {
        await this.handlePaymentCaptured(paymentId, orderId, "CASHFREE");
      } else if (paymentStatus === "FAILED" || paymentStatus === "USER_DROPPED") {
        await this.handlePaymentFailed(paymentId || orderId, "CASHFREE");
      }

      return { success: true };
    } catch (error) {
      this.logger.error("Cashfree webhook error:", error);
      throw error;
    }
  }

  private async handlePaymentCaptured(paymentId: string, orderId: string, provider: 'RAZORPAY' | 'CASHFREE') {
    this.logger.log(`Payment captured: ${paymentId} via ${provider}`);

    // Update transaction status in database
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { pgOrderId: orderId },
          { razorpayOrderId: orderId },
          { pgPaymentId: paymentId },
          { razorpayPaymentId: paymentId }
        ]
      },
    });

    if (transaction) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED",
          pgPaymentId: paymentId,
          pgProvider: provider,
          processedAt: new Date(),
        },
      });
    }
  }

  private async handlePaymentFailed(paymentId: string, provider: 'RAZORPAY' | 'CASHFREE') {
    this.logger.log(`Payment failed: ${paymentId} via ${provider}`);

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { pgPaymentId: paymentId },
          { pgOrderId: paymentId },
          { razorpayPaymentId: paymentId },
          { razorpayOrderId: paymentId }
        ]
      },
    });

    if (transaction) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "FAILED",
        },
      });
    }
  }
}
