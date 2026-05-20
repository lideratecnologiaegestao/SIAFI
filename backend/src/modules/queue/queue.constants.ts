export const QUEUE_FINANCE_NOTIFICATIONS = 'finance-notifications';
export const QUEUE_PAYMENT_PROCESSING = 'payment-processing';

// Job names — finance-notifications
export const JOB_WA_LEMBRETE_VENCIMENTO = 'whatsapp.lembrete-vencimento';
export const JOB_WA_COBRANCA_ATRASO = 'whatsapp.cobranca-atraso';
export const JOB_WA_CONFIRMACAO_PAGAMENTO = 'whatsapp.confirmacao-pagamento';
export const JOB_WA_PORTAL_ATIVADO = 'whatsapp.portal-ativado';
export const JOB_EMAIL_LEMBRETE = 'email.lembrete-vencimento';
export const JOB_EMAIL_CONFIRMACAO = 'email.confirmacao-pagamento';
export const JOB_EMAIL_PORTAL_ATIVADO = 'email.portal-ativado';

// Job names — payment-processing
export const JOB_PAYMENT_WEBHOOK = 'payment.webhook';
export const JOB_PAYMENT_CONCILIACAO = 'payment.conciliacao';
