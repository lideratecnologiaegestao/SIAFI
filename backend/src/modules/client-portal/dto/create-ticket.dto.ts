import { IsString, MinLength } from 'class-validator';

export class CreateTicketDto {
  @IsString()
  @MinLength(3)
  assunto: string;

  @IsString()
  @MinLength(10)
  mensagem: string;
}
