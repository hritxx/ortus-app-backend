import { Injectable, BadRequestException, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CreateOrderDto, VerifyPaymentDto, RefundPaymentDto } from "../dto/payment.dto";
import { PaymentGateway, CreateOrderResult, VerifyPaymentResult, RefundResult } from "../payment-gateway.interface";
import Razorpay from "razorpay";
import * as crypto from "crypto";

@Injectable()
export class RazorpayGateway implements PaymentGateway {
  private readonly logger = new Logger(RazorpayGateway.name);
  private razorpay: Razorpay;

  constructor(private configService: ConfigService) {
    const keyId = this.configService.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.configService.get<string>("RAZORPAY_KEY_SECRET");

    this.logger.log(`Initializing Razorpay with key_id: ${keyId ? keyId.substring(0, 10) + '...' : 'MISSING'}`);

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<CreateOrderResult> {
    try {
      const { amount, currency, receipt, notes } = createOrderDto;

      const shortReceipt = receipt || `rcpt_${Date.now().toString().slice(-10)}`;

      let parsedNotes = {};
      if (notes) {
        if (typeof notes === 'string') {
          try {
            parsedNotes = JSON.parse(notes);
          } catch (e) {
            this.logger.warn(`Failed to parse notes as JSON: ${notes}`);
            parsedNotes = { raw: notes };
          }
        } else if (typeof notes === 'object') {
          parsedNotes = notes;
        }
      }

      const orderData = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency || "INR",
        receipt: shortReceipt,
        notes: parsedNotes,
      };

      this.logger.log(`Creating Razorpay order: ${JSON.stringify(orderData)}`);
      const order = await this.razorpay.orders.create(orderData);

      return {
        success: true,
        orderId: order.id,
        amount: Number(order.amount) / 100, // Convert back to rupees
        currency: order.currency,
        receipt: order.receipt,
        publicKey: this.configService.get<string>("RAZORPAY_KEY_ID"),
        provider: 'RAZORPAY',
      };
    } catch (error: any) {
      this.logger.error(`Error creating Razorpay order: ${error?.message || error}`);
      throw new InternalServerErrorException(`Failed to create Razorpay order: ${error?.message || 'Unknown error'}`);
    }
  }

  async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyPaymentDto;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new BadRequestException("Missing Razorpay verification parameters");
    }

    try {
      const isDevelopment = this.configService.get<string>("NODE_ENV") === "development";

      if (isDevelopment) {
        this.logger.warn(`Skipping signature verification in development mode for: ${razorpayPaymentId}`);
      } else {
        const generatedSignature = crypto
          .createHmac("sha256", this.configService.get<string>("RAZORPAY_KEY_SECRET"))
          .update(`${razorpayOrderId}|${razorpayPaymentId}`)
          .digest("hex");

        if (generatedSignature !== razorpaySignature) {
          this.logger.warn(`Payment signature verification failed for user: ${userId}`);
          throw new BadRequestException("Invalid payment signature");
        }
      }

      const payment = await this.razorpay.payments.fetch(razorpayPaymentId);

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
        provider: 'RAZORPAY',
      };
    } catch (error: any) {
      this.logger.error("Razorpay verification error:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException("Razorpay verification failed");
    }
  }

  async refundPayment(userId: string, refundPaymentDto: RefundPaymentDto): Promise<RefundResult> {
    try {
      const { paymentId, amount, reason } = refundPaymentDto;
      const payment = await this.razorpay.payments.fetch(paymentId);

      if (!payment) {
        throw new BadRequestException("Payment not found");
      }

      const refund = await this.razorpay.payments.refund(paymentId, {
        amount: amount ? amount * 100 : undefined,
        notes: {
          reason: reason || "Customer requested refund",
        },
      });

      return {
        success: true,
        refundId: refund.id,
        amount: Number(refund.amount) / 100,
        status: refund.status,
      };
    } catch (error: any) {
      this.logger.error("Razorpay refund error:", error);
      throw new InternalServerErrorException("Refund processing failed");
    }
  }

  async getPaymentDetails(paymentId: string): Promise<any> {
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
    } catch (error: any) {
      this.logger.error("Error fetching payment details from Razorpay:", error);
      throw new InternalServerErrorException("Failed to fetch payment details");
    }
  }
}
