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

export class CreateCourseDto {
  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  thumbnail?: string;

  @IsEnum(CourseType)
  type: CourseType;

  @IsString()
  category: string;

  @IsNumber()
  @Min(1)
  duration: number; // in days

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxStudents?: number;

  @IsOptional()
  syllabus?: any; // JSON object

  @IsString()
  @IsOptional()
  instructor?: string;

  @IsOptional()
  metadata?: any; // JSON object
}
