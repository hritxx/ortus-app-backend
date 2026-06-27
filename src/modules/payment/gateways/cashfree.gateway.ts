import { Injectable, BadRequestException, InternalServerErrorException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { CreateOrderDto, VerifyPaymentDto, RefundPaymentDto } from "../dto/payment.dto";
import { PaymentGateway, CreateOrderResult, VerifyPaymentResult, RefundResult } from "../payment-gateway.interface";

@Injectable()
export class CashfreeGateway implements PaymentGateway {
  private readonly logger = new Logger(CashfreeGateway.name);
  private readonly appId: string;
  private readonly secretKey: string;
  private readonly env: string;
  private readonly baseUrl: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService
  ) {
    this.appId = this.configService.get<string>("CASHFREE_APP_ID") || "";
    this.secretKey = this.configService.get<string>("CASHFREE_SECRET_KEY") || "";
    this.env = this.configService.get<string>("CASHFREE_ENV") || "TEST";

    this.baseUrl = this.env === "PROD"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";

    this.logger.log(`Initializing Cashfree Gateway on ${this.env} mode. App ID: ${this.appId ? this.appId.substring(0, 10) + '...' : 'MISSING'}`);
  }

  async createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<CreateOrderResult> {
    try {
      const { amount, currency, receipt } = createOrderDto;

      // Fetch user details for Cashfree customer_details
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException("User not found");
      }

      const customerId = user.email
        ? user.email.replace(/[^a-zA-Z0-9]/g, "").slice(0, 50)
        : `cust_${userId.slice(-10)}`;

      const customerName = user.name || "Investor";
      const customerEmail = user.email;
      const customerPhone = (user.phone || "9999999999").replace(/\D/g, "").slice(-10);

      const orderId = receipt || `ord_${Date.now()}`;

      const payload = {
        order_amount: amount,
        order_currency: currency || "INR",
        order_id: orderId,
        customer_details: {
          customer_id: customerId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
        },
      };

      this.logger.log(`Creating Cashfree order ${orderId} for user ${userId}`);

      const response = await fetch(`${this.baseUrl}/orders`, {
        method: "POST",
        headers: {
          "x-client-id": this.appId,
          "x-client-secret": this.secretKey,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Cashfree Create Order API Error: ${errorText}`);
        throw new Error(`Cashfree order creation failed with status ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        orderId: data.order_id,
        paymentSessionId: data.payment_session_id,
        amount: data.order_amount,
        currency: data.order_currency,
        receipt: data.order_id,
        publicKey: this.appId,
        provider: "CASHFREE",
      };
    } catch (error: any) {
      this.logger.error(`Error creating Cashfree order: ${error?.message || error}`);
      throw new InternalServerErrorException(`Failed to create Cashfree order: ${error?.message || "Unknown error"}`);
    }
  }

  async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
    const orderId = verifyPaymentDto.orderId || verifyPaymentDto.razorpayOrderId;
    if (!orderId) {
      throw new BadRequestException("Missing orderId for Cashfree verification");
    }

    try {
      this.logger.log(`Verifying Cashfree order status: ${orderId}`);

      const response = await fetch(`${this.baseUrl}/orders/${orderId}`, {
        method: "GET",
        headers: {
          "x-client-id": this.appId,
          "x-client-secret": this.secretKey,
          "x-api-version": "2023-08-01",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Cashfree order info: ${response.statusText}`);
      }

      const data = await response.json();

      const verified = data.order_status === "PAID";

      return {
        success: true,
        verified,
        paymentId: data.order_id,
        orderId: data.order_id,
        amount: data.order_amount,
        currency: data.order_currency,
        status: data.order_status,
        provider: "CASHFREE",
      };
    } catch (error: any) {
      this.logger.error(`Cashfree payment verification error for order ${orderId}:`, error);
      throw new InternalServerErrorException(`Payment verification failed: ${error.message}`);
    }
  }

  async refundPayment(userId: string, refundPaymentDto: RefundPaymentDto): Promise<RefundResult> {
    try {
      const { paymentId, amount, reason } = refundPaymentDto;

      const refundId = `ref_${Date.now()}`;
      const payload = {
        refund_amount: amount,
        refund_id: refundId,
        refund_note: reason || "Customer requested refund",
      };

      this.logger.log(`Creating Cashfree refund for order ${paymentId}, amount: ${amount}`);

      const response = await fetch(`${this.baseUrl}/orders/${paymentId}/refunds`, {
        method: "POST",
        headers: {
          "x-client-id": this.appId,
          "x-client-secret": this.secretKey,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Cashfree Refund API Error: ${errorText}`);
        throw new Error(`Cashfree refund creation failed: ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        refundId: data.refund_id,
        amount: data.refund_amount,
        status: data.refund_status,
      };
    } catch (error: any) {
      this.logger.error("Cashfree refund error:", error);
      throw new InternalServerErrorException(`Refund processing failed: ${error.message}`);
    }
  }

  async getPaymentDetails(paymentId: string): Promise<any> {
    try {
      this.logger.log(`Fetching Cashfree payments for order: ${paymentId}`);

      const response = await fetch(`${this.baseUrl}/orders/${paymentId}/payments`, {
        method: "GET",
        headers: {
          "x-client-id": this.appId,
          "x-client-secret": this.secretKey,
          "x-api-version": "2023-08-01",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch payment details: ${response.statusText}`);
      }

      const payments = await response.json();
      const payment = payments[0] || {};

      return {
        success: true,
        payment: {
          id: payment.cf_payment_id || paymentId,
          orderId: paymentId,
          amount: payment.payment_amount,
          currency: payment.payment_currency || "INR",
          status: payment.payment_status,
          method: payment.payment_group,
          email: payment.customer_details?.customer_email,
          contact: payment.customer_details?.customer_phone,
          createdAt: payment.payment_time ? new Date(payment.payment_time) : new Date(),
        },
      };
    } catch (error: any) {
      this.logger.error(`Error fetching Cashfree payment details for order ${paymentId}:`, error);
      throw new InternalServerErrorException("Failed to fetch payment details");
    }
  }
}
