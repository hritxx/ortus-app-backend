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

      const customerName = user.name || "Investor";
      const customerEmail = user.email;
      const customerPhone = (user.phone || "9999999999").replace(/\D/g, "").slice(-10);

      // A Cashfree Payment Link returns a publicly-reachable hosted-checkout URL that
      // opens directly in a mobile browser (expo-web-browser) — unlike a payment
      // session, which requires the Cashfree JS/native SDK to render. This is what
      // fixes the previous "endpoint or method is not valid" error from the app
      // hand-building an invalid `/pg/view/checkout?session_id=` URL.
      const linkId = (receipt || `link_${Date.now()}_${userId.slice(-6)}`)
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 50);

      // Cashfree only accepts http(s) return URLs — a custom app scheme like
      // `ortus-finance://` is rejected with `link_meta.return_url_invalid`. The app
      // verifies payment after the in-app browser closes, so return_url is optional;
      // only include it when a valid https URL is configured (e.g. a deployed
      // redirect page or a universal link).
      const returnUrl = this.configService.get<string>("CASHFREE_RETURN_URL");

      const payload: Record<string, any> = {
        link_id: linkId,
        link_amount: amount,
        link_currency: currency || "INR",
        link_purpose: "Ortus Finance payment",
        customer_details: {
          customer_phone: customerPhone,
          customer_name: customerName,
          customer_email: customerEmail,
        },
        link_partial_payments: false,
        link_notify: { send_sms: false, send_email: false },
        link_auto_reminders: false,
      };

      if (returnUrl && /^https?:\/\//.test(returnUrl)) {
        payload.link_meta = { return_url: `${returnUrl}?link_id=${linkId}` };
      }

      this.logger.log(`Creating Cashfree payment link ${linkId} for user ${userId}`);

      const response = await fetch(`${this.baseUrl}/links`, {
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
        this.logger.error(`Cashfree Create Link API Error: ${errorText}`);
        throw new Error(`Cashfree link creation failed with status ${response.status}`);
      }

      const data = await response.json();

      return {
        success: true,
        orderId: data.link_id,
        checkoutUrl: data.link_url,
        amount: data.link_amount,
        currency: data.link_currency,
        receipt: data.link_id,
        publicKey: this.appId,
        provider: "CASHFREE",
      };
    } catch (error: any) {
      this.logger.error(`Error creating Cashfree payment link: ${error?.message || error}`);
      throw new InternalServerErrorException(`Failed to create Cashfree order: ${error?.message || "Unknown error"}`);
    }
  }

  async verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto): Promise<VerifyPaymentResult> {
    const linkId = verifyPaymentDto.orderId || verifyPaymentDto.razorpayOrderId;
    if (!linkId) {
      throw new BadRequestException("Missing orderId/linkId for Cashfree verification");
    }

    try {
      this.logger.log(`Verifying Cashfree payment link status: ${linkId}`);

      const response = await fetch(`${this.baseUrl}/links/${linkId}`, {
        method: "GET",
        headers: {
          "x-client-id": this.appId,
          "x-client-secret": this.secretKey,
          "x-api-version": "2023-08-01",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch Cashfree link info: ${response.statusText}`);
      }

      const data = await response.json();

      // link_status: ACTIVE | PAID | PARTIALLY_PAID | EXPIRED | CANCELLED
      const verified = data.link_status === "PAID";

      return {
        success: true,
        verified,
        paymentId: data.link_id,
        orderId: data.link_id,
        amount: data.link_amount,
        currency: data.link_currency,
        status: data.link_status,
        provider: "CASHFREE",
      };
    } catch (error: any) {
      this.logger.error(`Cashfree payment verification error for link ${linkId}:`, error);
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
