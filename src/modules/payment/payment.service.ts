import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import Razorpay from "razorpay";
import * as crypto from "crypto";
import {
  CreateOrderDto,
  VerifyPaymentDto,
  RefundPaymentDto,
} from "./dto/payment.dto";

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    this.razorpay = new Razorpay({
      key_id: this.configService.get<string>("RAZORPAY_KEY_ID"),
      key_secret: this.configService.get<string>("RAZORPAY_KEY_SECRET"),
    });
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto) {
    try {
      const { amount, currency, receipt, notes } = createOrderDto;

      // Generate short receipt if not provided (Razorpay max: 40 chars)
      const shortReceipt =
        receipt || `rcpt_${Date.now().toString().slice(-10)}`;

      // Create Razorpay order
      const order = await this.razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency: currency || "INR",
        receipt: shortReceipt,
        notes: notes ? JSON.parse(notes) : {},
      });

      this.logger.log(`Order created: ${order.id} for user: ${userId}`);

      return {
        success: true,
        orderId: order.id,
        amount: Number(order.amount) / 100, // Convert back to rupees
        currency: order.currency,
        receipt: order.receipt,
        razorpayKeyId: this.configService.get<string>("RAZORPAY_KEY_ID"),
      };
    } catch (error) {
      this.logger.error("Error creating Razorpay order:", error);
      throw new InternalServerErrorException("Failed to create payment order");
    }
  }

  async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto) {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      verifyPaymentDto;

    try {
      // Generate signature for verification
      const generatedSignature = crypto
        .createHmac(
          "sha256",
          this.configService.get<string>("RAZORPAY_KEY_SECRET")
        )
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        this.logger.warn(`Payment verification failed for user: ${userId}`);
        throw new BadRequestException("Invalid payment signature");
      }

      // Fetch payment details from Razorpay
      const payment = await this.razorpay.payments.fetch(razorpayPaymentId);

      this.logger.log(
        `Payment verified: ${razorpayPaymentId} for user: ${userId}`
      );

      return {
        success: true,
        verified: true,
        paymentId: payment.id,
        orderId: payment.order_id,
        amount: Number(payment.amount) / 100,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        createdAt: new Date(Number(payment.created_at) * 1000),
      };
    } catch (error) {
      this.logger.error("Payment verification error:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException("Payment verification failed");
    }
  }

  async handleWebhook(payload: any, signature: string) {
    try {
      const webhookSecret = this.configService.get<string>(
        "RAZORPAY_WEBHOOK_SECRET"
      );

      // Verify webhook signature
      const generatedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      if (generatedSignature !== signature) {
        this.logger.warn("Invalid webhook signature");
        throw new BadRequestException("Invalid webhook signature");
      }

      const event = payload.event;
      const paymentEntity = payload.payload.payment.entity;

      this.logger.log(
        `Webhook received: ${event} for payment: ${paymentEntity.id}`
      );

      // Handle different webhook events
      switch (event) {
        case "payment.captured":
          await this.handlePaymentCaptured(paymentEntity);
          break;
        case "payment.failed":
          await this.handlePaymentFailed(paymentEntity);
          break;
        case "order.paid":
          await this.handleOrderPaid(paymentEntity);
          break;
        default:
          this.logger.log(`Unhandled webhook event: ${event}`);
      }

      return {
        success: true,
        message: "Webhook processed successfully",
      };
    } catch (error) {
      this.logger.error("Webhook processing error:", error);
      throw error;
    }
  }

  private async handlePaymentCaptured(paymentEntity: any) {
    this.logger.log(`Payment captured: ${paymentEntity.id}`);

    // Update transaction status in database
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        razorpayPaymentId: paymentEntity.id,
      },
    });

    if (transaction) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
        },
      });
    }
  }

  private async handlePaymentFailed(paymentEntity: any) {
    this.logger.log(`Payment failed: ${paymentEntity.id}`);

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        razorpayPaymentId: paymentEntity.id,
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

  private async handleOrderPaid(paymentEntity: any) {
    this.logger.log(`Order paid: ${paymentEntity.order_id}`);
    // Additional logic for order completion
  }

  async refundPayment(userId: string, refundPaymentDto: RefundPaymentDto) {
    try {
      const { paymentId, amount, reason } = refundPaymentDto;

      // Fetch original payment
      const payment = await this.razorpay.payments.fetch(paymentId);

      if (!payment) {
        throw new BadRequestException("Payment not found");
      }

      // Create refund
      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amount ? amount * 100 : undefined, // Partial refund if amount specified
        notes: {
          reason: reason || "Customer requested refund",
        },
      });

      // Update transaction in database
      const transaction = await this.prisma.transaction.findFirst({
        where: {
          razorpayPaymentId: paymentId,
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

      this.logger.log(
        `Refund processed: ${refund.id} for payment: ${paymentId}`
      );

      return {
        success: true,
        refundId: refund.id,
        amount: Number(refund.amount) / 100,
        status: refund.status,
      };
    } catch (error) {
      this.logger.error("Refund error:", error);
      throw new InternalServerErrorException("Refund processing failed");
    }
  }

  async getPaymentDetails(paymentId: string) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);

      return {
        success: true,
        payment: {
          id: payment.id,
          orderId: payment.order_id,
          amount: Number(payment.amount) / 100,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          email: payment.email,
          contact: payment.contact,
          createdAt: new Date(Number(payment.created_at) * 1000),
        },
      };
    } catch (error) {
      this.logger.error("Error fetching payment details:", error);
      throw new InternalServerErrorException("Failed to fetch payment details");
    }
  }
}
