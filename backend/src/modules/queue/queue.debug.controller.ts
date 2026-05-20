import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  QUEUE_FINANCE_NOTIFICATIONS,
  QUEUE_PAYMENT_PROCESSING,
  JOB_WA_LEMBRETE_VENCIMENTO,
  JOB_WA_CONFIRMACAO_PAGAMENTO,
  JOB_PAYMENT_WEBHOOK,
} from './queue.constants';
import type { NotificationJobData, PaymentJobData } from './queue.interfaces';

@Controller('debug/queue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class QueueDebugController {
  constructor(
    @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS)
    private readonly notificationsQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_PAYMENT_PROCESSING)
    private readonly paymentQueue: Queue<PaymentJobData>,
  ) {}

  @Get('status')
  async getStatus() {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Desabilitado em produção' };
    }

    const [notifCounts, paymentCounts] = await Promise.all([
      this.notificationsQueue.getJobCounts(),
      this.paymentQueue.getJobCounts(),
    ]);

    return {
      [QUEUE_FINANCE_NOTIFICATIONS]: notifCounts,
      [QUEUE_PAYMENT_PROCESSING]: paymentCounts,
    };
  }

  @Post('test-whatsapp')
  async testWhatsapp(
    @Body() body: { clientId: number; tipo?: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Desabilitado em produção' };
    }

    const jobName = body.tipo === 'confirmacao'
      ? JOB_WA_CONFIRMACAO_PAGAMENTO
      : JOB_WA_LEMBRETE_VENCIMENTO;

    const job = await this.notificationsQueue.add(jobName, {
      clientId: body.clientId ?? 1,
      clienteNome: 'Cliente Teste',
      clienteWhatsapp: process.env.DEBUG_WHATSAPP ?? '5565999999999',
      valorParcela: 500,
      dataVencimento: new Intl.DateTimeFormat('pt-BR').format(new Date()),
    });

    return { jobId: job.id, jobName, status: 'enfileirado' };
  }

  @Post('test-payment')
  async testPayment(
    @Body() body: { paymentId: string; status?: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Desabilitado em produção' };
    }

    const job = await this.paymentQueue.add(
      JOB_PAYMENT_WEBHOOK,
      {
        paymentId: body.paymentId ?? 'test-123',
        externalReference: body.paymentId ?? 'test-123',
        status: body.status ?? 'approved',
        amount: 0,
        origem: 'manual',
      },
      { jobId: `debug-mp-${body.paymentId ?? 'test'}-${Date.now()}` },
    );

    return { jobId: job.id, status: 'enfileirado' };
  }
}
