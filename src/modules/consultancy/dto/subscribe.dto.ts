import { IsString, IsOptional, IsBoolean } from "class-validator";

export class SubscribeDto {
  @IsBoolean()
  @IsOptional()
  autoRenew?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
