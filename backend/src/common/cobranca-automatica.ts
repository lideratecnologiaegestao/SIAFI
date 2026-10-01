/**
 * Liga/desliga a COBRANCA AUTOMATICA (as rotinas que disparam aviso ao cliente
 * por conta propria) por instalacao.
 *
 * ⚠️ NAO DESLIGA A ESCRITURACAO. As rotinas que mantem a base correta seguem
 * rodando — `mark-overdue` (marca a parcela como atrasada) e `atualizar-encargos`
 * (multa e mora). Sem elas a carteira de inadimplentes e os encargos param de
 * existir, o que seria muito pior do que mandar aviso.
 *
 * ⚠️ NAO DESLIGA NOTIFICACAO TRANSACIONAL. Redefinicao de senha, ativacao do
 * portal, resposta de LGPD e o fluxo consultor→financeiro continuam saindo: sao
 * resposta a uma acao de alguem, nao cobranca disparada pelo sistema.
 *
 * ⚠️ NAO IMPEDE A COBRANCA MANUAL. O operador segue podendo disparar pela tela
 * de Cobrancas. O que para e so o automatico.
 *
 * Segue a convencao do CRON_ENABLED: so desliga com o valor explicito 'false',
 * entao quem nao definir nada continua cobrando — a DEMO e os proximos clientes
 * nao mudam de comportamento.
 */
export const COBRANCA_AUTOMATICA_ATIVA =
  process.env.COBRANCA_AUTOMATICA_ENABLED !== 'false';
