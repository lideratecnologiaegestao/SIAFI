import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QUEUE_FINANCE_NOTIFICATIONS,
  QUEUE_PAYMENT_PROCESSING,
  JOB_WA_LEMBRETE_VENCIMENTO,
  JOB_WA_COBRANCA_ATRASO,
  JOB_EMAIL_LEMBRETE,
  JOB_PAYMENT_CONCILIACAO,
} from '../queue/queue.constants';
import type { NotificationJobData, PaymentJobData } from '../queue/queue.interfaces';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS)
    private readonly notificationsQueue: Queue<NotificationJobData>,
    @InjectQueue(QUEUE_PAYMENT_PROCESSING)
    private readonly paymentQueue: Queue<PaymentJobData>,
  ) {}

  @Cron('0 8 * * *', { name: 'mark-overdue', timeZone: 'America/Sao_Paulo' })
  async markOverdueInstallments(): Promise<void> {
    this.logger.log('Cron: marcando parcelas em atraso');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.installment.updateMany({
      where: { status: 'pendente', dataVencimento: { lt: today } },
      data: { status: 'atrasado' },
    });

    this.logger.log(`${result.count} parcelas marcadas como atrasado`);
  }

  @Cron('0 9 * * *', { name: 'send-reminders', timeZone: 'America/Sao_Paulo' })
  async sendReminders(): Promise<void> {
    this.logger.log('Cron: enfileirando lembretes de vencimento (próximos 3 dias)');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const parcelas = await this.prisma.installment.findMany({
      where: {
        status: 'pendente',
        dataVencimento: { gte: today, lte: threeDaysLater },
      },
      include: { loan: { include: { client: { select: { id: true, nome: true, whatsapp: true, email: true } } } } },
    });

    const todayStr = today.toISOString().split('T')[0];
    let enfileirados = 0;

    for (const parcela of parcelas) {
      const client = parcela.loan.client;
      const dtVenc = new Intl.DateTimeFormat('pt-BR').format(new Date(parcela.dataVencimento));

      const jobData: NotificationJobData = {
        clientId: client.id,
        clienteNome: client.nome,
        clienteWhatsapp: client.whatsapp ?? undefined,
        clienteEmail: client.email ?? undefined,
        installmentId: parcela.id,
        loanId: parcela.loanId,
        valorParcela: Number(parcela.valor),
        dataVencimento: dtVenc,
      };

      if (client.whatsapp) {
        await this.notificationsQueue.add(JOB_WA_LEMBRETE_VENCIMENTO, jobData, {
          jobId: `lembrete-wa-${parcela.id}-${todayStr}`,
        });
        enfileirados++;
      }
      if (client.email) {
        await this.notificationsQueue.add(JOB_EMAIL_LEMBRETE, jobData, {
          jobId: `lembrete-email-${parcela.id}-${todayStr}`,
        });
        enfileirados++;
      }
    }

    this.logger.log(`${enfileirados} lembretes enfileirados para ${parcelas.length} parcelas`);
  }

  @Cron('0 10 * * *', { name: 'send-overdue', timeZone: 'America/Sao_Paulo' })
  async sendOverdueNotices(): Promise<void> {
    this.logger.log('Cron: enfileirando cobranças de atraso');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const atrasadas = await this.prisma.installment.findMany({
      where: { status: 'atrasado', dataVencimento: { gte: today, lt: tomorrow } },
      include: { loan: { include: { client: { select: { id: true, nome: true, whatsapp: true } } } } },
    });

    const todayStr = today.toISOString().split('T')[0];
    let enfileirados = 0;

    for (const parcela of atrasadas) {
      const client = parcela.loan.client;
      if (!client.whatsapp) continue;

      await this.notificationsQueue.add(
        JOB_WA_COBRANCA_ATRASO,
        {
          clientId: client.id,
          clienteNome: client.nome,
          clienteWhatsapp: client.whatsapp,
          installmentId: parcela.id,
          loanId: parcela.loanId,
          valorParcela: Number(parcela.valor),
        },
        { jobId: `cobranca-wa-${parcela.id}-${todayStr}` },
      );
      enfileirados++;
    }

    this.logger.log(`${enfileirados} cobranças enfileiradas`);
  }

  @Cron('0 2 * * *', { name: 'conciliacao-pix', timeZone: 'America/Sao_Paulo' })
  async conciliacaoPix(): Promise<void> {
    this.logger.log('Cron: enfileirando job de conciliação PIX');

    await this.paymentQueue.add(
      JOB_PAYMENT_CONCILIACAO,
      { paymentId: '', externalReference: '', status: 'cron', amount: 0, origem: 'cron' },
      { jobId: `conciliacao-${new Date().toISOString().split('T')[0]}` },
    );
  }
}
