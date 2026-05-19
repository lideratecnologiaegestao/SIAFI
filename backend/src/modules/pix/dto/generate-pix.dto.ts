import { IsEnum, IsInt, IsOptional, IsPositive, Max, Min } from 'class-validator';

export enum ChargeTipo {
  PIX = 'pix',
  BOLETO = 'boleto',
}

export class GeneratePixDto {
  @IsInt()
  @IsPositive()
  installmentId: number;

  @IsOptional()
  @IsEnum(ChargeTipo)
  tipo?: ChargeTipo;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(72)
  expirationHours?: number;

  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(30)
  expirationDays?: number;
}
