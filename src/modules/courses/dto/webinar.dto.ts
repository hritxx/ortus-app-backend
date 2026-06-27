import { IsString, IsOptional, IsNumber, IsDateString, IsUrl } from "class-validator";

export class CreateWebinarDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  scheduledAt: string;

  @IsNumber()
  duration: number; // in minutes

  @IsString()
  meetingLink: string;

  @IsString()
  @IsOptional()
  courseId?: string; // Optional - if not provided, it represents a global webinar
}
