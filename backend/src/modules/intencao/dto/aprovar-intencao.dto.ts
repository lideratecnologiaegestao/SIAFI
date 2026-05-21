import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class AprovarIntencaoDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  principalAmount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  targetProfit: number;

  @IsInt()
  @Min(1)
  @Max(360)
  numeroParcelas: number;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  metodoPagamento?: PaymentMethod;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
