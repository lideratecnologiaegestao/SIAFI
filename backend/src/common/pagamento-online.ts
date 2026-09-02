/**
 * Liga/desliga o GATEWAY de pagamento online (Mercado Pago / PIX com QR code)
 * por instalacao.
 *
 * ⚠️ NAO CONFUNDIR COM A BAIXA POR PIX. `metodoPagamento: 'pix'` e o registro de
 * que o cliente transferiu por PIX — e o meio MAIS USADO da carteira (362 das
 * 390 baixas). Isto aqui desliga apenas a emissao de cobranca pelo Mercado Pago:
 * o QR code, o webhook e a conciliacao automatica.
 *
 * Segue a convencao do CRON_ENABLED: so desliga com o valor explicito 'false',
 * entao quem nao definir nada continua com o gateway ligado — a DEMO e os
 * proximos clientes nao mudam de comportamento.
 */
export const PAGAMENTO_ONLINE_ATIVO = process.env.PAGAMENTO_ONLINE_ENABLED !== 'false';

export const MOTIVO_PAGAMENTO_ONLINE_DESLIGADO =
  'Pagamento online (Mercado Pago) esta desabilitado nesta instalacao.';
