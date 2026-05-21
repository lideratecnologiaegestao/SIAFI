import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class PropostaDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  novoValorPrincipal: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  novoTargetProfit: number;

  @IsInt()
  @Min(1)
  @Max(360)
  novoNumeroParcelas: number;

  @IsDateString()
  novaDataInicio: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  multaAplicada?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  moraAplicada?: number;

  @IsOptional()
  @IsString()
  observacaoFinanceiro?: string;
}
