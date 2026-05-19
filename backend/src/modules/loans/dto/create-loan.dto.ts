import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { AmortizationType, PaymentMethod } from '@prisma/client';

export class CreateLoanDto {
  @IsInt()
  @IsPositive()
  clientId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorInvestido?: number;

  @IsOptional()
  @IsEnum(AmortizationType)
  tipoAmortizacao?: AmortizationType;

  // taxaJuros OU valorParcela devem ser informados — nunca ambos nulos
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  @ValidateIf((o: CreateLoanDto) => !o.valorParcela)
  taxaJuros?: number;

  @IsOptional()
  @IsIn(['mensal', 'anual'])
  modoTaxa?: 'mensal' | 'anual';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @ValidateIf((o: CreateLoanDto) => !o.taxaJuros)
  valorParcela?: number;

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
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  taxaMulta?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  taxaMora?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  periodoCarencia?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
