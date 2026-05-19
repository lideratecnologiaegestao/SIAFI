import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class TransactionFilterDto extends PaginationDto {
  @IsOptional()
  @IsIn(['entrada', 'saida'])
  tipo?: 'entrada' | 'saida';

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  categoria?: string;
}
