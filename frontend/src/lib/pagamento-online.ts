/**
 * Espelho do flag do backend (PAGAMENTO_ONLINE_ENABLED) para a interface.
 *
 * ⚠️ NAO CONFUNDIR COM A BAIXA POR PIX. O metodo "PIX" das baixas — cliente
 * transferiu e o operador registrou — e o mais usado da carteira e continua
 * existindo em toda a tela de Recebimentos e no historico. Este flag esconde
 * apenas a COBRANCA ONLINE: gerar QR code do Mercado Pago e pagar pelo portal.
 *
 * NEXT_PUBLIC_* e embutido no bundle no momento do build, entao o valor vem por
 * build-arg da imagem. Como no backend, so desliga com 'false' explicito.
 */
export const PAGAMENTO_ONLINE_ATIVO =
  process.env.NEXT_PUBLIC_PAGAMENTO_ONLINE !== 'false';
