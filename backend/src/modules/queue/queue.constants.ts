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

// Job names — intencao
export const JOB_INTENCAO_NOVA      = 'intencao.nova';
export const JOB_INTENCAO_APROVADA  = 'intencao.aprovada';
export const JOB_INTENCAO_REJEITADA = 'intencao.rejeitada';
export const JOB_INTENCAO_SLA_ALERTA   = 'intencao.sla-alerta';
export const JOB_INTENCAO_SLA_ESCALADA = 'intencao.sla-escalada';

// Job names — proposta / liberação
export const JOB_PROPOSTA_EXPIRANDO_CLIENTE  = 'proposta.expirando-cliente';
export const JOB_PROPOSTA_EXPIRADA_CONSULTOR = 'proposta.expirada-consultor';
export const JOB_CAPITAL_LIBERADO            = 'proposta.capital-liberado';

// Job names — cobrança antecipada
export const JOB_WA_COBRANCA_ANTECIPADA     = 'whatsapp.cobranca-antecipada';
export const JOB_EMAIL_COBRANCA_ANTECIPADA  = 'email.cobranca-antecipada';

// Job names — link de acesso ao portal (substituiu senha temporária)
export const JOB_EMAIL_LINK_ACESSO = 'email.link-acesso';

// Job names — aceite de contrato
export const JOB_EMAIL_ACEITE_CONTRATO  = 'email.aceite-contrato';
export const JOB_WA_ACEITE_CONTRATO     = 'whatsapp.aceite-contrato';

// Job names — capital liberado
export const JOB_EMAIL_CAPITAL_LIBERADO = 'email.capital-liberado';
export const JOB_WA_CAPITAL_LIBERADO    = 'whatsapp.capital-liberado';
