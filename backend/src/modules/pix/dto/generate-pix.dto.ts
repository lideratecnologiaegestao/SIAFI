import { IsInt, IsPositive } from 'class-validator';

export class GeneratePixDto {
  @IsInt() @IsPositive() installmentId: number;
}
