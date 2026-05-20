import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

function stripNonDigits(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\D/g, '');
  return value;
}

function toBoolean(value: unknown): unknown {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return value;
}

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nome?: string;

  @IsOptional()
  @Transform(({ value }) => stripNonDigits(value))
  @IsString()
  @Matches(/^\d{11}$|^\d{14}$/, { message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos' })
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
  @Transform(({ value }) => toBoolean(value))
  notificacoesEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => toBoolean(value))
  active?: boolean;
}
