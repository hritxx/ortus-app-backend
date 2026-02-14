import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class AttachmentDto {
  @IsString()
  type: string;

  @IsString()
  url: string;

  @IsString()
  @IsOptional()
  name?: string;
}

export class CreatePostDto {
  @IsString()
  content: string;

  @IsEnum(["ANNOUNCEMENT", "STOCK_TIP", "MEETING_LINK", "RESOURCE"])
  @IsOptional()
  type?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @IsString()
  @IsOptional()
  meetingLink?: string;

  @IsDateString()
  @IsOptional()
  eventTime?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}

export class UpdatePostDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(["ANNOUNCEMENT", "STOCK_TIP", "MEETING_LINK", "RESOURCE"])
  @IsOptional()
  type?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @IsString()
  @IsOptional()
  meetingLink?: string;

  @IsDateString()
  @IsOptional()
  eventTime?: string;

  @IsBoolean()
  @IsOptional()
  isPinned?: boolean;
}
