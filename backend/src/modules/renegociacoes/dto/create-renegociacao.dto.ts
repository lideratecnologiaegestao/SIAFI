import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateRenegociacaoDto {
  @IsInt()
  @IsPositive()
  loanId: number;

  @IsNumber()
  @Min(0.01)
  taxaJuros: number;

  @IsInt()
  @IsPositive()
  numeroParcelas: number;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
