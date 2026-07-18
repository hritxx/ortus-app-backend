import { IsString, IsNumber, IsBoolean, IsOptional, Min } from "class-validator";

export class RedeemDto {
  @IsString() schemeCode: string;
  @IsOptional() @IsString() schemeName?: string;
  @IsString() folioNumber: string;
  @IsOptional() @IsNumber() @Min(0.001) units?: number;
  @IsOptional() @IsBoolean() allUnits?: boolean;
  @IsOptional() @IsString() idempotencyKey?: string;
}
