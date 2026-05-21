import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  // Aceita username, e-mail ou CPF (identificador unificado)
  identificador: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
