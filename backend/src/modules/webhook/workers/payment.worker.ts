import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import axios from 'axios';
import Decimal from 'decimal.js';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  QUEUE_PAYMENT_PROCESSING,
  QUEUE_FINANCE_NOTIFICATIONS,
  JOB_PAYMENT_WEBHOOK,
  JOB_PAYMENT_CONCILIACAO,
  JOB_WA_CONFIRMACAO_PAGAMENTO,
  JOB_EMAIL_CONFIRMACAO,
} from '../../queue/queue.constants';
import type { PaymentJobData, NotificationJobData } from '../../queue/queue.interfaces';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface MpPaymentDetail {
  id: number;
  status: string;
  transaction_amount: number;
  payment_method_id: string;
  external_reference?: string;
  date_approved?: string;
}

// Padrão do externalReference enviado ao Mercado Pago
const EXT_REF_RE = /^SIAFI_INST_(\d+)_LOAN_(\d+)$/;

@Processor(QUEUE_PAYMENT_PROCESSING, { concurrency: 3 })
export class PaymentWorker extends WorkerHost {
  private readonly logger = new Logger(PaymentWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS)
    private readonly notificationsQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_PAYMENT_PROCESSING)
    private readonly paymentQueue: Queue<PaymentJobData>,
  ) {
    super();
  }

  async process(job: Job<PaymentJobData>): Promise<void> {
    switch (job.name) {
      case JOB_PAYMENT_WEBHOOK:
        await this.handleWebhookPayment(job);
        break;

      case JOB_PAYMENT_CONCILIACAO:
        await this.handleConciliacao(job);
        break;

      default:
        this.logger.warn(`Job name desconhecido: ${job.name}`);
    }
  }

  private async handleWebhookPayment(job: Job<PaymentJobData>): Promise<void> {
    const { paymentId } = job.data;

    const mpDetail = await this.fetchMpPayment(paymentId);
    if (!mpDetail) throw new Error(`Falha ao consultar MP para paymentId=${paymentId}`);

    const { status } = mpDetail;

    if (status === 'pending' || status === 'in_process') {
      this.logger.log(`Pagamento ${paymentId} ainda em processamento (status=${status})`);
      return;
    }

    if (status === 'rejected' || status === 'cancelled') {
      // Atualizar pix_payment para cancelado se existir
      await this.prisma.pixPayment.updateMany({
        where: { paymentId, status: { not: 'pago' } },
        data:  { status: 'cancelado' },
      });
      await this.prisma.auditLog.create({
        data: {
          acao:     `PAGAMENTO_MP_${status.toUpperCase()}`,
          entidade: 'payment',
          contexto: { paymentId, status, origem: job.data.origem },
        },
      });
      return;
    }

    if (status !== 'approved') {
      this.logger.warn(`Status desconhecido: ${status} para paymentId=${paymentId}`);
      return;
    }

    // ── Localizar PixPayment pelo paymentId (lookup primário) ────────────────
    let pixPayment = await this.prisma.pixPayment.findFirst({
      where: { paymentId },
      include: {
        installment: {
          include: {
            loan: {
              include: {
                client: { select: { id: true, nome: true, whatsapp: true, email: true } },
              },
            },
          },
        },
      },
    });

    // ── Fallback via externalReference (SIAFI_INST_{id}_LOAN_{id}) ──────────
    if (!pixPayment && mpDetail.external_reference) {
      const match = mpDetail.external_reference.match(EXT_REF_RE);
      if (match) {
        const installmentId = parseInt(match[1], 10);
        pixPayment = await this.prisma.pixPayment.findFirst({
          where: {
            installmentId,
            status: { not: 'cancelado' },
          },
          include: {
            installment: {
              include: {
                loan: {
                  include: {
                    client: { select: { id: true, nome: true, whatsapp: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (pixPayment) {
          this.logger.log(
            `Fallback via externalReference: installmentId=${installmentId}, pixId=${pixPayment.id}`,
          );
        }
      }
    }

    if (!pixPayment) {
      this.logger.warn(`PixPayment não encontrado para paymentId=${paymentId}`);
      return;
    }

    const inst   = pixPayment.installment;
    const client = inst.loan.client;

    // Idempotência: checar se já foi processado
    const jaProcessado = await this.prisma.payment.findFirst({
      where: {
        installmentId:   inst.id,
        metodoPagamento: 'pix',
        observacao:      { contains: paymentId },
      },
    });

    if (jaProcessado) {
      this.logger.log(`Pagamento MP #${paymentId} já processado (payment.id=${jaProcessado.id}) — ignorando`);
      return;
    }

    if (inst.status === 'pago') {
      this.logger.log(`Installment #${inst.id} já está paga — apenas atualizando pix_payment`);
      await this.prisma.pixPayment.update({
        where: { id: pixPayment.id },
        data:  { status: 'pago', paymentId },
      });
      return;
    }

    const valorPago    = mpDetail.transaction_amount;
    const valorDecimal = new Decimal(valorPago.toString());
    const novoTotal    = new Decimal(inst.totalPago.toString()).plus(valorDecimal);
    const valorInst    = new Decimal(inst.installmentAmount.toString());
    const novoStatus   = novoTotal.gte(valorInst) ? 'pago' : inst.status;

    await this.prisma.$transaction(async (tx) => {
      // 1. Atualizar pix_payment → pago
      await tx.pixPayment.update({
        where: { id: pixPayment!.id },
        data:  { status: 'pago', paymentId, updatedAt: new Date() },
      });

      // 2. Cancelar outros pix_payments pendentes da mesma parcela
      await tx.pixPayment.updateMany({
        where: {
          installmentId: inst.id,
          id:            { not: pixPayment!.id },
          status:        'pendente',
        },
        data: { status: 'cancelado' },
      });

      // 3. Criar registro em payments
      await tx.payment.create({
        data: {
          installmentId:   inst.id,
          valorPago:       valorDecimal.toDecimalPlaces(2).toNumber(),
          dataPagamento:   mpDetail.date_approved ? new Date(mpDetail.date_approved) : new Date(),
          metodoPagamento: 'pix',
          observacao:      `PIX via Mercado Pago — ID ${paymentId}`,
        },
      });

      // 4. Atualizar installment
      await tx.installment.update({
        where: { id: inst.id },
        data:  { totalPago: novoTotal.toDecimalPlaces(2).toNumber(), status: novoStatus },
      });

      // 5. Transaction de entrada no caixa
      await tx.transaction.create({
        data: {
          tipo:      'entrada',
          valor:     valorDecimal.toDecimalPlaces(2).toNumber(),
          descricao: `PIX MP - Parcela #${inst.numero} - ${client.nome}`,
          categoria: 'Pagamento PIX',
          data:      mpDetail.date_approved ? new Date(mpDetail.date_approved) : new Date(),
        },
      });

      // 6. Quitar loan se todas as parcelas estão pagas
      if (novoStatus === 'pago') {
        const unpaid = await tx.installment.count({
          where: {
            loanId: inst.loanId,
            status: { notIn: ['pago', 'cancelado'] },
            id:     { not: inst.id },
          },
        });
        if (unpaid === 0) {
          await tx.loan.update({ where: { id: inst.loanId }, data: { status: 'quitado' } });
          this.logger.log(`Loan #${inst.loanId} marcado como quitado`);
        }
      }

      // 7. AuditLog
      await tx.auditLog.create({
        data: {
          acao:     'PAGAMENTO_MP_APROVADO',
          entidade: 'payment',
          contexto: { paymentId, valorPago, installmentId: inst.id, novoStatus },
        },
      });
    });

    this.logger.log(
      `✅ Webhook processado — Parcela #${inst.id} · Loan #${inst.loanId} · R$ ${valorPago} · MP #${paymentId}`,
    );

    // Notificações (fire-and-forget)
    const notifData: NotificationJobData = {
      clientId:        client.id,
      clienteNome:     client.nome,
      clienteWhatsapp: client.whatsapp ?? undefined,
      clienteEmail:    client.email ?? undefined,
      valorParcela:    valorPago,
    };

    if (client.whatsapp) {
      await this.notificationsQueue.add(JOB_WA_CONFIRMACAO_PAGAMENTO, notifData, {
        jobId: `confirmacao-wa-${paymentId}`,
      }).catch(() => {});
    }
    if (client.email) {
      await this.notificationsQueue.add(JOB_EMAIL_CONFIRMACAO, notifData, {
        jobId: `confirmacao-email-${paymentId}`,
      }).catch(() => {});
    }
  }

  private async handleConciliacao(job: Job<PaymentJobData>): Promise<void> {
    const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000);

    const pendentes = await this.prisma.pixPayment.findMany({
      where: { status: 'pendente', createdAt: { lt: umaHoraAtras } },
    });

    this.logger.log(`Conciliação: verificando ${pendentes.length} PIX pendentes`);

    for (const pix of pendentes) {
      if (!pix.paymentId) continue;

      try {
        const mpDetail = await this.fetchMpPayment(pix.paymentId);
        if (!mpDetail || mpDetail.status !== 'approved') continue;

        await this.paymentQueue.add(
          JOB_PAYMENT_WEBHOOK,
          {
            paymentId:         pix.paymentId,
            externalReference: pix.paymentId,
            status:            mpDetail.status,
            amount:            mpDetail.transaction_amount,
            origem:            'cron',
          },
          { jobId: `conciliacao-${pix.paymentId}` },
        );
      } catch (err) {
        this.logger.error(`Erro na conciliação de PIX ${pix.paymentId}`, err);
      }
    }

    await this.prisma.auditLog.create({
      data: {
        acao:     'CONCILIACAO_PIX_EXECUTADA',
        entidade: 'queue',
        contexto: { jobId: job.id, total: pendentes.length },
      },
    });
  }

  private async fetchMpPayment(paymentId: string): Promise<MpPaymentDetail | null> {
    try {
      const token = process.env.MP_ACCESS_TOKEN;
      const { data } = await axios.get<MpPaymentDetail>(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 },
      );
      return data;
    } catch (err) {
      this.logger.error(`Falha ao consultar MP payment ${paymentId}`, err);
      return null;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PaymentJobData>, error: Error): Promise<void> {
    this.logger.error(`Job ${job.name} (id=${job.id}) falhou definitivamente: ${error.message}`);

    await this.prisma.auditLog.create({
      data: {
        acao:     `${job.name.toUpperCase().replace(/\./g, '_')}_FALHOU`,
        entidade: 'queue',
        contexto: {
          jobId:      job.id,
          jobName:    job.name,
          erro:       error.message,
          paymentId:  job.data.paymentId,
          tentativas: job.attemptsMade,
        },
      },
    });
  }
}
