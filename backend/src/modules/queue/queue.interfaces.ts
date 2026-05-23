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
  isReenvio?: boolean;
  linkAcesso?: string;
  isAtivacao?: boolean;
  pdfBase64?: string;
  principalAmount?: number;
  numeroParcelas?: number;
  needsPasswordSetup?: boolean;
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
