import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ClientFilterDto extends PaginationDto {
  @IsOptional()
  @IsIn(['active', 'inactive', ''])
  status?: 'active' | 'inactive' | '';
}
