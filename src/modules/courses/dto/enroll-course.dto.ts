import { IsString, IsOptional } from "class-validator";

export class VerifyPaymentDto {
  // Cashfree payment-link id returned by /courses/:id/enroll.
  @IsString()
  @IsOptional()
  orderId?: string;

  // Legacy Razorpay fields (kept optional for backward compatibility).
  @IsString()
  @IsOptional()
  razorpayOrderId?: string;

  @IsString()
  @IsOptional()
  razorpayPaymentId?: string;

  @IsString()
  @IsOptional()
  razorpaySignature?: string;

  @IsString()
  enrollmentId: string;
}
