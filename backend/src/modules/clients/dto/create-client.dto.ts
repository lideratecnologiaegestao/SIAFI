import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateClientDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  nome: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, { message: 'CPF deve conter exatamente 11 dígitos numéricos' })
  cpf?: string;

  @IsOptional()
  @IsString()
  rg?: string;

  @IsOptional()
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2, { message: 'Estado deve ter exatamente 2 caracteres' })
  estado?: string;

  @IsOptional()
  @IsString()
  cep?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true || value === 1 || value === '1') return true;
    if (value === 'false' || value === false || value === 0 || value === '0') return false;
    return value;
  })
  notificacoesEmail?: boolean;
}
