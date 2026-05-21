import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

interface MpWebhookPayload {
  action?: string;
  data?: { id: string };
  live_mode?: boolean;
  type?: string;
  id?: number | string;
}

interface MpPaymentDetail {
  id: number;
  status: string;
  transaction_amount: number;
  payment_method_id: string;
  external_reference?: string;
  date_approved?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  validateSignature(signature: string, requestId: string, ts: string, secret: string): boolean {
    try {
      const parts = signature.split(',').reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split('=');
        acc[k] = v;
        return acc;
      }, {});

      const manifest = `id=${requestId}&ts=${parts.ts ?? ts}`;
      const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
      return parts.v1 === expected;
    } catch {
      return false;
    }
  }

  async fetchMpPayment(paymentId: string): Promise<MpPaymentDetail | null> {
    try {
      const token = process.env.MP_ACCESS_TOKEN;
      const { data } = await axios.get<MpPaymentDetail>(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return data;
    } catch (err) {
      this.logger.error(`Failed to fetch MP payment ${paymentId}`, err);
      return null;
    }
  }

  async handlePaymentApproved(paymentId: string, mpDetail: MpPaymentDetail): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const pixPayment = await tx.pixPayment.findFirst({
        where: { paymentId },
      });

      if (!pixPayment) {
        this.logger.warn(`PixPayment not found for paymentId=${paymentId}`);
        return;
      }

      await tx.pixPayment.update({
        where: { id: pixPayment.id },
        data: { status: 'pago', updatedAt: new Date() },
      });

      const installment = await tx.installment.findUnique({
        where: { id: pixPayment.installmentId },
        include: { loan: { include: { client: { select: { nome: true } } } } },
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

      const clientNome = installment.loan.client.nome;
      await tx.transaction.create({
        data: {
          tipo: 'entrada',
          valor: valorPago,
          descricao: `PIX MP - Parcela #${installment.numero} - ${clientNome}`,
          categoria: 'Pagamento PIX',
          data: mpDetail.date_approved ? new Date(mpDetail.date_approved) : new Date(),
        },
      });
    });
  }

  async processWebhook(
    payload: MpWebhookPayload,
    signature: string | undefined,
    requestId: string | undefined,
  ): Promise<{ received: boolean; processed: boolean }> {
    const isLive = payload.live_mode === true;
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (isLive && secret && signature && requestId) {
      const parts = signature.split(',');
      const ts = parts.find((p) => p.startsWith('ts='))?.split('=')[1] ?? '';
      const valid = this.validateSignature(signature, requestId, ts, secret);
      if (!valid) {
        this.logger.warn('Invalid webhook signature');
        return { received: false, processed: false };
      }
    }

    if (payload.type !== 'payment' || !payload.data?.id) {
      return { received: true, processed: false };
    }

    const paymentId = payload.data.id;
    const mpDetail = await this.fetchMpPayment(paymentId);

    if (!mpDetail || mpDetail.status !== 'approved') {
      return { received: true, processed: false };
    }

    await this.handlePaymentApproved(paymentId, mpDetail);
    return { received: true, processed: true };
  }
}
