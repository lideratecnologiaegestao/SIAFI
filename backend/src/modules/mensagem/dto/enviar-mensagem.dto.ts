import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class EnviarMensagemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  conteudo: string;

  @IsOptional()
  @IsString()
  tipo?: string; // 'texto' | 'arquivo'
}
