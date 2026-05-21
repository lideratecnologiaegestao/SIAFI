import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CriarConversaDto {
  // Para conversa direta com outro usuário
  @IsOptional()
  @IsInt()
  @IsPositive()
  targetUserId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  titulo?: string;
}
