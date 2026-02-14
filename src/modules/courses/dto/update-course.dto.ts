import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  Min,
} from "class-validator";
import { CourseType } from "@prisma/client";

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;

  @IsEnum(CourseType)
  @IsOptional()
  type?: CourseType;

  @IsString()
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  duration?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxStudents?: number;

  @IsOptional()
  syllabus?: any;

  @IsString()
  @IsOptional()
  instructor?: string;

  @IsOptional()
  metadata?: any;
}
