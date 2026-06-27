import { IsString, IsNumber, IsIn, Min } from "class-validator";

export class PurchaseDto {
  @IsString() schemeCode: string;
  @IsString() schemeName: string;
  @IsNumber() @Min(100) amount: number; // VERIFY min vs scheme minPurchase
  @IsIn(["LUMPSUM", "SIP"]) type: "LUMPSUM" | "SIP";
}
