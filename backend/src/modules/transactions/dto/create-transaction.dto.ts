import { IsDateString, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['entrada', 'saida'])
  tipo: 'entrada' | 'saida';

  @IsNumber()
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsDateString()
  data: string;
}
