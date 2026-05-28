import { IsOptional, IsString, Matches } from 'class-validator';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export class UpdateEmpresaDto {
  @IsOptional() @IsString() nome?: string
  @IsOptional() @IsString() nomeFantasia?: string
  @IsOptional() @IsString() cnpj?: string
  @IsOptional() @IsString() inscricaoEstadual?: string
  @IsOptional() @IsString() email?: string
  @IsOptional() @IsString() emailFinanceiro?: string
  @IsOptional() @IsString() telefone?: string
  @IsOptional() @IsString() whatsapp?: string
  @IsOptional() @IsString() site?: string
  @IsOptional() @IsString() logradouro?: string
  @IsOptional() @IsString() numero?: string
  @IsOptional() @IsString() complemento?: string
  @IsOptional() @IsString() bairro?: string
  @IsOptional() @IsString() cidade?: string
  @IsOptional() @IsString() estado?: string
  @IsOptional() @IsString() cep?: string
  @IsOptional() @IsString() faviconUrl?: string
  @IsOptional() @IsString() @Matches(HEX_COLOR, { message: 'corPrimaria deve ser hex #RRGGBB' })   corPrimaria?: string
  @IsOptional() @IsString() @Matches(HEX_COLOR, { message: 'corSecundaria deve ser hex #RRGGBB' }) corSecundaria?: string
  @IsOptional() @IsString() @Matches(HEX_COLOR, { message: 'corAcento deve ser hex #RRGGBB' })     corAcento?: string
  @IsOptional() @IsString() @Matches(HEX_COLOR, { message: 'corTexto deve ser hex #RRGGBB' })      corTexto?: string
  @IsOptional() @IsString() @Matches(HEX_COLOR, { message: 'corFundo deve ser hex #RRGGBB' })      corFundo?: string
  @IsOptional() @IsString() rodapePdf?: string
  @IsOptional() @IsString() clausulasAdicionais?: string
}
