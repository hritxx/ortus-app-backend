import { IsString, MinLength } from "class-validator";

export class CreateCommentDto {
  @IsString()
  @MinLength(1, { message: "Comment content cannot be empty" })
  content: string;
}
