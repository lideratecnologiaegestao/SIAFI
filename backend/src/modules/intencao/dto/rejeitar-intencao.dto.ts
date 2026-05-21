import { IsIn, IsOptional, IsString } from 'class-validator';

export const MOTIVOS_REJEICAO = [
  'renda_insuficiente',
  'score_baixo',
  'documentacao',
  'historico_negativo',
  'capacidade_pagamento',
  'outro',
] as const;

export class RejeitarIntencaoDto {
  @IsString()
  @IsIn(MOTIVOS_REJEICAO)
  motivoTipo: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
