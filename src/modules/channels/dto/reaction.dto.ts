import { IsString } from "class-validator";

export class ReactionDto {
  @IsString()
  emoji: string;
}
