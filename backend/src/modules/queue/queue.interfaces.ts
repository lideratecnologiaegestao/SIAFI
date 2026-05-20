export interface NotificationJobData {
  clientId: number;
  clienteNome: string;
  clienteWhatsapp?: string;
  clienteEmail?: string;
  loanId?: number;
  installmentId?: number;
  valorParcela?: number;
  dataVencimento?: string;
  senhaTemporaria?: string;
  templateVars?: Record<string, string>;
}

export interface PaymentJobData {
  paymentId: string;
  externalReference: string;
  status: string;
  amount: number;
  dateApproved?: string;
  installmentId?: number;
  origem: 'webhook' | 'cron' | 'manual';
}
