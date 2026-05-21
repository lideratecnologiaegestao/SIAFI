import { IsDateString, IsIn, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export const TIPOS_REPARCELAMENTO = [
  'prorrogacao',
  'reducao_parcelas',
  'aumento_prazo',
  'reducao_juros',
  'composicao_divida',
  'outro',
] as const;

export class CreateSolicitacaoDto {
  @IsInt()
  @IsPositive()
  loanId: number;

  @IsString()
  @IsIn(TIPOS_REPARCELAMENTO)
  tipo: string;

  @IsString()
  motivoCliente: string;

  @IsOptional()
  @IsDateString()
  dataPrevistaPagamento?: string;
}
