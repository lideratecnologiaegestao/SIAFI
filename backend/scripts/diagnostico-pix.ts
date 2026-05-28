import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()

async function main() {
  console.log('\n═══ 1. pix_payments duplicados (mesma parcela) ═══')
  const duplicatas = await p.$queryRaw`
    SELECT
      installment_id,
      COUNT(*)                       AS total_qrcodes,
      STRING_AGG(id::text, ', ')     AS ids,
      STRING_AGG(status, ', ')       AS statuses,
      STRING_AGG(COALESCE(payment_id, 'null'), ', ') AS payment_ids,
      STRING_AGG(amount::text, ', ') AS valores
    FROM pix_payments
    GROUP BY installment_id
    HAVING COUNT(*) > 1
    ORDER BY installment_id
  `
  console.log(duplicatas)

  console.log('\n═══ 2. pix_payments com status pago mas installment não pago ═══')
  const inconsistentes = await p.$queryRaw`
    SELECT
      pp.id              AS pix_id,
      pp.installment_id,
      pp.status          AS pix_status,
      pp.payment_id      AS mp_payment_id,
      pp.amount,
      pp.created_at,
      i.status           AS installment_status,
      i.total_pago,
      i.installment_amount AS installment_valor,
      (SELECT COUNT(*) FROM payments WHERE installment_id = i.id) AS qtd_payments
    FROM pix_payments pp
    JOIN installments i ON i.id = pp.installment_id
    WHERE pp.status IN ('pago', 'approved')
      AND i.status NOT IN ('pago', 'cancelado')
    ORDER BY pp.created_at DESC
  `
  console.log(inconsistentes)

  console.log('\n═══ 3. installments pagas sem registro em payments ═══')
  const semPayment = await p.$queryRaw`
    SELECT
      i.id, i.loan_id, i.numero, i.installment_amount AS valor, i.status,
      i.total_pago, i.data_vencimento,
      (SELECT COUNT(*) FROM payments WHERE installment_id = i.id) AS qtd_payments,
      (SELECT COUNT(*) FROM pix_payments WHERE installment_id = i.id) AS qtd_pix
    FROM installments i
    WHERE i.status = 'pago'
      AND NOT EXISTS (SELECT 1 FROM payments WHERE installment_id = i.id)
    ORDER BY i.loan_id, i.numero
  `
  console.log(semPayment)

  console.log('\n═══ 4. Últimos 20 pix_payments (estado geral) ═══')
  const ultimosPix = await p.$queryRaw`
    SELECT id, installment_id, payment_id, status, amount, expires_at, created_at, updated_at
    FROM pix_payments
    ORDER BY created_at DESC
    LIMIT 20
  `
  console.log(ultimosPix)

  console.log('\n═══ 5. Loans com parcelas em estados inconsistentes ═══')
  const loansInconsistentes = await p.$queryRaw`
    SELECT
      l.id AS loan_id,
      l.status AS loan_status,
      COUNT(i.id) AS total_parcelas,
      SUM(CASE WHEN i.status = 'pago' THEN 1 ELSE 0 END) AS pagas,
      SUM(CASE WHEN i.status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
      SUM(CASE WHEN i.status = 'atrasado' THEN 1 ELSE 0 END) AS atrasadas,
      SUM(CASE WHEN i.status = 'cancelado' THEN 1 ELSE 0 END) AS canceladas
    FROM loans l
    JOIN installments i ON i.loan_id = l.id
    WHERE l.status = 'ativo'
    GROUP BY l.id, l.status
    HAVING SUM(CASE WHEN i.status NOT IN ('pago','cancelado') THEN 1 ELSE 0 END) = 0
    ORDER BY l.id
    LIMIT 10
  `
  console.log('\nLoans ativos com todas parcelas pagas/canceladas (deveriam ser quitado):')
  console.log(loansInconsistentes)

  console.log('\n═══ 6. Contagem geral de pix_payments por status ═══')
  const contagem = await p.$queryRaw`
    SELECT status, COUNT(*) AS total FROM pix_payments GROUP BY status ORDER BY total DESC
  `
  console.log(contagem)

  console.log('\n═══ 7. Pagamentos duplicados (mesmo installment_id, método pix, sem estorno) ═══')
  const pagDuplicados = await p.$queryRaw`
    SELECT
      installment_id,
      COUNT(*) AS qtd,
      STRING_AGG(id::text, ', ') AS ids,
      STRING_AGG(valor_pago::text, ', ') AS valores
    FROM payments
    WHERE metodo_pagamento = 'pix' AND estornado = false
    GROUP BY installment_id
    HAVING COUNT(*) > 1
    ORDER BY installment_id
  `
  console.log(pagDuplicados)
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
