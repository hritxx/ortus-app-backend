import { IsString, IsNumber, IsOptional, Min, IsEnum } from "class-validator";

export class CreateOrderDto {
  @IsNumber()
  @Min(1, { message: "Amount must be at least 1" })
  amount: number;

  @IsString()
  currency: string = "INR";

  @IsString()
  @IsOptional()
  receipt?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class VerifyPaymentDto {
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
  @IsOptional()
  orderId?: string;
}

export class WebhookDto {
  @IsString()
  event: string;

  @IsOptional()
  payload: any;
}

export class RefundPaymentDto {
  @IsString()
  paymentId: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
