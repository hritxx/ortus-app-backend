import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  Min,
  Max,
} from "class-validator";

export class BookSessionDto {
  @IsDateString()
  scheduledAt: string;

  @IsNumber()
  @Min(30)
  @Max(120)
  duration: number; // Duration in minutes (30, 60, 90, 120)

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
