import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { name: 'mark-overdue', timeZone: 'America/Sao_Paulo' })
  async markOverdueInstallments(): Promise<void> {
    this.logger.log('Running: mark overdue installments');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.installment.updateMany({
      where: {
        status: 'pendente',
        dataVencimento: { lt: today },
      },
      data: { status: 'atrasado' },
    });

    this.logger.log(`Marked ${result.count} installments as overdue`);
  }

  @Cron('0 9 * * *', { name: 'notify-overdue', timeZone: 'America/Sao_Paulo' })
  async notifyOverdueClients(): Promise<void> {
    this.logger.log('Running: notify overdue clients');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const overdueInstallments = await this.prisma.installment.findMany({
      where: {
        status: 'atrasado',
        dataVencimento: { gte: today, lt: tomorrow },
      },
      select: { id: true },
    });

    let notified = 0;
    for (const inst of overdueInstallments) {
      try {
        await this.notificationsService.notifyOverdue(inst.id);
        notified++;
      } catch (err) {
        this.logger.error(`Failed to notify installment ${inst.id}`, err);
      }
    }

    this.logger.log(`Notified ${notified} overdue installments`);
  }

  @Cron('0 10 * * *', { name: 'notify-due-today', timeZone: 'America/Sao_Paulo' })
  async notifyDueToday(): Promise<void> {
    this.logger.log('Running: notify due today');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueToday = await this.prisma.installment.findMany({
      where: {
        status: 'pendente',
        dataVencimento: { gte: today, lt: tomorrow },
      },
      include: {
        loan: {
          include: {
            client: { select: { id: true, nome: true, whatsapp: true } },
          },
        },
      },
    });

    for (const inst of dueToday) {
      const client = inst.loan.client;
      if (!client.whatsapp) continue;

      const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
        Number(inst.valor),
      );

      const message =
        `Olá ${client.nome}! ` +
        `Sua parcela #${inst.numero} no valor de ${valor} vence hoje. ` +
        `Efetue o pagamento para evitar juros. SIAFI`;

      const sent = await this.notificationsService.sendWhatsApp(client.whatsapp, message);

      await this.notificationsService.logNotification({
        clientId: client.id,
        loanId: inst.loanId,
        tipo: 'whatsapp',
        assunto: `Parcela #${inst.numero} vence hoje`,
        mensagem: message,
        status: sent ? 'enviado' : 'erro',
      });
    }

    this.logger.log(`Sent due-today reminders for ${dueToday.length} installments`);
  }
}
