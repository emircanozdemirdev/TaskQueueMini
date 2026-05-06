import { IsObject, IsString, MinLength } from "class-validator";

export class CreateJobDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
