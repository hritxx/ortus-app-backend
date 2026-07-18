import { IsString, IsNumber, IsIn, Min, IsOptional } from "class-validator";

export class PurchaseDto {
  @IsString() schemeCode: string;
  @IsString() schemeName: string;
  @IsNumber() @Min(100) amount: number; // CONFIRM: min vs scheme minPurchase
  @IsOptional() @IsIn(["LUMPSUM", "SIP"]) type?: "LUMPSUM" | "SIP";
  @IsOptional() @IsString() idempotencyKey?: string;
}
