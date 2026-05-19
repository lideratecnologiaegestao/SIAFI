import { IsIn, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class LoanFilterDto extends PaginationDto {
  @IsOptional()
  @IsIn(['ativo', 'quitado', 'cancelado', 'inadimplente', ''])
  status?: 'ativo' | 'quitado' | 'cancelado' | 'inadimplente' | '';

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  clientId?: number;
}
