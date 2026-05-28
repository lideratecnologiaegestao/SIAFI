import { PrismaClient } from '@prisma/client'
import Decimal from 'decimal.js'
const p = new PrismaClient()

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })

async function main() {
  console.log('═══ Iniciando reconciliação PIX ═══\n')

  // ── 1. Para cada pix_payment com status "pago"
  //       que não tem um payment registrado:
  //       criar o payment e atualizar a installment ──────────────────

  const pixPagos = await p.pixPayment.findMany({
    where: { status: { in: ['pago'] } },
    include: {
      installment: {
        include: {
          payments: true,
          loan: {
            select: { id: true, numeroParcelas: true }
          }
        }
      }
    }
  })

  console.log(`Encontrados ${pixPagos.length} pix_payments com status=pago`)

  for (const pix of pixPagos) {
    const inst = pix.installment
    const jaTemPayment = inst.payments.some(
      pay => pay.metodoPagamento === 'pix' && !pay.estornado
    )

    if (jaTemPayment) {
      console.log(`  Parcela #${inst.id} (Loan #${inst.loanId}) já tem payment PIX registrado — pulando`)
      continue
    }

    console.log(`\n  Reconciliando parcela #${inst.id} (Loan #${inst.loanId}, nº ${inst.numero}/${inst.loan.numeroParcelas})...`)

    await p.$transaction(async (tx) => {
      // 1a. Criar registro em payments
      await tx.payment.create({
        data: {
          installmentId:   inst.id,
          valorPago:       pix.amount.toNumber(),
          dataPagamento:   pix.updatedAt ?? pix.createdAt,
          metodoPagamento: 'pix',
          observacao:      `Reconciliação automática — PIX #${pix.id} · MP PaymentId: ${pix.paymentId ?? 'N/A'}`,
        }
      })
      console.log(`    ✅ Payment criado — R$ ${pix.amount} (PIX #${pix.id})`)

      // 1b. Atualizar totalPago na installment
      const novoTotalPago = new Decimal(inst.totalPago.toString()).plus(pix.amount.toString())
      const installmentAmount = new Decimal(inst.installmentAmount.toString())
      const novoStatus = novoTotalPago.gte(installmentAmount) ? 'pago' : inst.status

      await tx.installment.update({
        where: { id: inst.id },
        data: {
          totalPago: novoTotalPago.toDecimalPlaces(2).toNumber(),
          status:    novoStatus,
        }
      })
      console.log(`    ✅ Installment #${inst.id} → totalPago=${novoTotalPago.toFixed(2)}, status=${novoStatus}`)

      // 1c. Cancelar outros pix_payments pendentes da mesma parcela
      const cancelados = await tx.pixPayment.updateMany({
        where: {
          installmentId: inst.id,
          id:            { not: pix.id },
          status:        'pendente',
        },
        data: { status: 'cancelado' }
      })
      if (cancelados.count > 0) {
        console.log(`    ✅ ${cancelados.count} pix_payment(s) pendentes cancelados para installment #${inst.id}`)
      }

      // 1d. Se todas as parcelas do loan foram pagas, quitar o loan
      if (novoStatus === 'pago') {
        const parcelas = await tx.installment.findMany({
          where: { loanId: inst.loanId }
        })
        const todasPagas = parcelas.every(
          p2 => p2.id === inst.id ? true : p2.status === 'pago' || p2.status === 'cancelado'
        )
        if (todasPagas) {
          await tx.loan.update({
            where: { id: inst.loanId },
            data: { status: 'quitado' }
          })
          console.log(`    ✅ Loan #${inst.loanId} marcado como quitado`)
        }
      }

      // 1e. Criar Transaction de entrada no caixa (se não existir)
      const transacaoExiste = await tx.transaction.findFirst({
        where: {
          descricao: { contains: `PIX #${pix.id}` }
        }
      })
      if (!transacaoExiste) {
        await tx.transaction.create({
          data: {
            tipo:      'entrada',
            valor:     pix.amount.toDecimalPlaces(2).toNumber(),
            descricao: `Pagamento PIX · Parcela ${inst.numero}/${inst.loan.numeroParcelas} · Loan #${inst.loanId} · PIX #${pix.id}`,
            categoria: 'Pagamento de Parcela',
            data:      pix.updatedAt ?? pix.createdAt,
          }
        })
        console.log(`    ✅ Transaction de entrada criada no caixa`)
      } else {
        console.log(`    ⚠️  Transaction de entrada já existe — pulando`)
      }
    })
  }

  // ── 2. Marcar como "cancelado" os pix_payments "pendente"
  //       de parcelas que já foram pagas ────────────────────────────
  console.log('\n═══ Cancelando PIX órfãos de parcelas pagas ═══')
  const pixOrfaos = await p.pixPayment.findMany({
    where: {
      status: 'pendente',
      installment: { status: 'pago' }
    }
  })

  for (const pix of pixOrfaos) {
    await p.pixPayment.update({
      where: { id: pix.id },
      data:  { status: 'cancelado' }
    })
    console.log(`  🗑  PIX #${pix.id} cancelado (installment #${pix.installmentId} já paga)`)
  }

  if (pixOrfaos.length === 0) {
    console.log('  Nenhum PIX órfão encontrado')
  }

  console.log('\n══════════════════════════════════════════')
  console.log('✅ Reconciliação concluída')
  console.log('══════════════════════════════════════════')
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect())
