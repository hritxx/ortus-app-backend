import { CreateOrderDto, VerifyPaymentDto, RefundPaymentDto } from './dto/payment.dto';

export interface CreateOrderResult {
  success: boolean;
  orderId: string;
  paymentSessionId?: string; // only for Cashfree
  amount: number;
  currency: string;
  receipt?: string;
  publicKey?: string;
  provider: 'CASHFREE' | 'RAZORPAY';
}

export interface VerifyPaymentResult {
  success: boolean;
  verified: boolean;
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  createdAt?: Date;
  provider: 'CASHFREE' | 'RAZORPAY';
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
}

export interface PaymentGateway {
  createOrder(userId: string, createOrderDto: CreateOrderDto): Promise<CreateOrderResult>;
  verifyPayment(userId: string, verifyPaymentDto: VerifyPaymentDto): Promise<VerifyPaymentResult>;
  refundPayment(userId: string, refundPaymentDto: RefundPaymentDto): Promise<RefundResult>;
  getPaymentDetails(paymentId: string): Promise<any>;
}
