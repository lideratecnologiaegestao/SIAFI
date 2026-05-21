import { IsOptional, IsString } from 'class-validator';

export class RejeitarSolicitacaoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
