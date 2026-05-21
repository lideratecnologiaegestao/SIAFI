import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import axios from 'axios';
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

interface MpPaymentDetail {
  id: number;
  status: string;
  transaction_amount: number;
  payment_method_id: string;
  external_reference?: string;
  date_approved?: string;
}

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

    if (!mpDetail) {
      throw new Error(`Falha ao consultar MP para paymentId=${paymentId}`);
    }

    const status = mpDetail.status;

    if (status === 'pending' || status === 'in_process') {
      this.logger.log(`Pagamento ${paymentId} ainda em processamento (status=${status})`);
      return;
    }

    if (status === 'rejected' || status === 'cancelled') {
      await this.prisma.auditLog.create({
        data: {
          acao: `PAGAMENTO_MP_${status.toUpperCase()}`,
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

    const pixPayment = await this.prisma.pixPayment.findFirst({ where: { paymentId } });
    if (!pixPayment) {
      this.logger.warn(`PixPayment não encontrado para paymentId=${paymentId}`);
      return;
    }

    let clientId: number | undefined;
    let clientNome: string | undefined;
    let clientWhatsapp: string | undefined;
    let clientEmail: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.pixPayment.update({
        where: { id: pixPayment.id },
        data: { status: 'pago', updatedAt: new Date() },
      });

      const installment = await tx.installment.findUnique({
        where: { id: pixPayment.installmentId },
        include: {
          loan: { include: { client: { select: { id: true, nome: true, whatsapp: true, email: true } } } },
        },
      });

      if (!installment || installment.status === 'pago') return;

      const valorPago = mpDetail.transaction_amount;
      const novoTotalPago = Number(installment.totalPago) + valorPago;
      const novoStatus = novoTotalPago >= Number(installment.installmentAmount) ? 'pago' : installment.status;

      await tx.payment.create({
        data: {
          installmentId: installment.id,
          valorPago,
          dataPagamento: mpDetail.date_approved ? new Date(mpDetail.date_approved) : new Date(),
          metodoPagamento: 'pix',
          observacao: `PIX via Mercado Pago — ID ${paymentId}`,
        },
      });

      await tx.installment.update({
        where: { id: installment.id },
        data: { totalPago: novoTotalPago, status: novoStatus },
      });

      if (novoStatus === 'pago') {
        const unpaid = await tx.installment.count({
          where: {
            loanId: installment.loanId,
            status: { not: 'pago' },
            id: { not: installment.id },
          },
        });
        if (unpaid === 0) {
          await tx.loan.update({ where: { id: installment.loanId }, data: { status: 'quitado' } });
        }
      }

      const client = installment.loan.client;
      clientId = client.id;
      clientNome = client.nome;
      clientWhatsapp = client.whatsapp ?? undefined;
      clientEmail = client.email ?? undefined;

      await tx.transaction.create({
        data: {
          tipo: 'entrada',
          valor: valorPago,
          descricao: `PIX MP - Parcela #${installment.numero} - ${client.nome}`,
          categoria: 'Pagamento PIX',
          data: mpDetail.date_approved ? new Date(mpDetail.date_approved) : new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          acao: 'PAGAMENTO_MP_APROVADO',
          entidade: 'payment',
          contexto: { paymentId, valorPago, installmentId: installment.id, novoStatus },
        },
      });
    });

    if (clientId && clientNome) {
      const notifData: NotificationJobData = {
        clientId,
        clienteNome: clientNome,
        clienteWhatsapp: clientWhatsapp,
        clienteEmail: clientEmail,
        valorParcela: mpDetail.transaction_amount,
      };

      if (clientWhatsapp) {
        await this.notificationsQueue.add(JOB_WA_CONFIRMACAO_PAGAMENTO, notifData, {
          jobId: `confirmacao-wa-${paymentId}`,
        });
      }
      if (clientEmail) {
        await this.notificationsQueue.add(JOB_EMAIL_CONFIRMACAO, notifData, {
          jobId: `confirmacao-email-${paymentId}`,
        });
      }
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
            paymentId: pix.paymentId,
            externalReference: pix.paymentId,
            status: mpDetail.status,
            amount: mpDetail.transaction_amount,
            origem: 'cron',
          },
          { jobId: `conciliacao-${pix.paymentId}` },
        );
      } catch (err) {
        this.logger.error(`Erro na conciliação de PIX ${pix.paymentId}`, err);
      }
    }

    await this.prisma.auditLog.create({
      data: {
        acao: 'CONCILIACAO_PIX_EXECUTADA',
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
        acao: `${job.name.toUpperCase().replace(/\./g, '_')}_FALHOU`,
        entidade: 'queue',
        contexto: {
          jobId: job.id,
          jobName: job.name,
          erro: error.message,
          paymentId: job.data.paymentId,
          tentativas: job.attemptsMade,
        },
      },
    });
  }
}
