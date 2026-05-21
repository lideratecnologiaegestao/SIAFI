import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class CreateIntencaoDto {
  @IsInt()
  @IsPositive()
  clientId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valorSolicitado: number;

  @IsInt()
  @Min(1)
  @Max(360)
  numeroParcelas: number;

  @IsOptional()
  @IsString()
  finalidade?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
