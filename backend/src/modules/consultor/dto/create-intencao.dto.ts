import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsIn,
  Min,
} from 'class-validator';

export class CreateIntencaoDto {
  @IsInt()
  @IsPositive()
  clientId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorSolicitado: number;

  @IsInt()
  @Min(1)
  numeroParcelas: number;

  @IsOptional()
  @IsString()
  finalidade?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}

export class AprovarIntencaoDto {
  @IsString()
  @IsIn(['aprovado', 'rejeitado'])
  status: 'aprovado' | 'rejeitado';

  @IsOptional()
  @IsString()
  observacoes?: string;
}
