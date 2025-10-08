import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
  IsDateString,
} from "class-validator";

export class CreateInvestmentDto {
  @IsString()
  planId: string;

  @IsNumber()
  @Min(1, { message: "Investment amount must be at least 1" })
  amountInvested: number;

  @IsNumber()
  @IsOptional()
  sipAmount?: number;

  @IsNumber()
  @IsOptional()
  swpAmount?: number;

  @IsDateString()
  @IsOptional()
  nextSipDate?: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateInvestmentDto {
  @IsNumber()
  @IsOptional()
  sipAmount?: number;

  @IsNumber()
  @IsOptional()
  swpAmount?: number;

  @IsDateString()
  @IsOptional()
  nextSipDate?: string;

  @IsEnum(["ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"])
  @IsOptional()
  status?: string;
}

export class ProcessSIPDto {
  @IsString()
  investmentId: string;

  @IsString()
  paymentId: string;

  @IsNumber()
  amount: number;
}
