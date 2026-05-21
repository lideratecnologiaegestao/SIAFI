import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateCobrancaDto {
  @IsInt()
  @IsPositive()
  installmentId: number;

  @IsInt()
  @IsPositive()
  clientId: number;

  @IsString()
  @IsIn(['whatsapp', 'ligacao', 'presencial'])
  canal: string;

  @IsString()
  @IsIn(['prometeu_pagar', 'nao_atendeu', 'numero_incorreto', 'outro'])
  resultado: string;

  @IsOptional()
  @IsDateString()
  prometeuPagarEm?: string;

  @IsOptional()
  @IsString()
  observacao?: string;
}
