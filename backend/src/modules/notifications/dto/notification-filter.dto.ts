import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class NotificationFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;
}
