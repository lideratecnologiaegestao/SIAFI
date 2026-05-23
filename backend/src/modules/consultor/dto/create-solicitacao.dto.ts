import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsIn,
  MaxLength,
} from 'class-validator';

export class CreateSolicitacaoDto {
  @IsInt()
  @IsPositive()
  clientId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  loanId?: number;

  @IsString()
  @IsIn(['desconto', 'reparcelamento', 'intencao_emprestimo', 'outro'])
  tipo: string;

  @IsString()
  @IsNotEmpty()
  descricao: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorSolicitado?: number;

  @IsOptional()
  @IsString()
  @IsIn(['normal', 'alta'])
  urgencia?: string;
}

export class ResponderSolicitacaoDto {
  @IsString()
  @IsIn(['aprovado', 'rejeitado'])
  status: 'aprovado' | 'rejeitado';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  respostaFinanceiro?: string;
}
