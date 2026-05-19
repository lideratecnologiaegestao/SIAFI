import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @IsPositive()
  installmentId: number;

  @IsNumber()
  @IsPositive()
  valorPago: number;

  @IsDateString()
  dataPagamento: string;

  @IsOptional()
  @IsIn(['dinheiro', 'pix', 'mercadopago', 'transferencia', 'cheque', 'cartao'])
  metodoPagamento: 'dinheiro' | 'pix' | 'mercadopago' | 'transferencia' | 'cheque' | 'cartao' =
    'dinheiro';

  @IsOptional()
  observacao?: string;
}
