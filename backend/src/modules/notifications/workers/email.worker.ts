import { Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../../prisma/prisma.service';
import { QUEUE_FINANCE_NOTIFICATIONS } from '../../queue/queue.constants';
import {
  JOB_EMAIL_LEMBRETE,
  JOB_EMAIL_CONFIRMACAO,
  JOB_EMAIL_PORTAL_ATIVADO,
} from '../../queue/queue.constants';
import type { NotificationJobData } from '../../queue/queue.interfaces';

const LOGO_URL = 'https://financeiro.lidera.app.br/logo.png';
const PORTAL_URL = 'https://financeiro.lidera.app.br/portal';

@Processor(QUEUE_FINANCE_NOTIFICATIONS, { concurrency: 3 })
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { clienteEmail } = job.data;

    if (!clienteEmail) {
      this.logger.warn(`Job ${job.id} ignorado: cliente sem email (clientId=${job.data.clientId})`);
      return;
    }

    const { subject, html } = this.buildTemplate(job);

    await this.sendEmail(clienteEmail, subject, html);

    await this.prisma.notification.create({
      data: {
        clientId: job.data.clientId,
        loanId: job.data.loanId ?? null,
        tipo: 'email',
        assunto: subject,
        mensagem: `Email enviado: ${subject}`,
        status: 'enviado',
        sentAt: new Date(),
      },
    });
  }

  private buildTemplate(job: Job<NotificationJobData>): { subject: string; html: string } {
    const { clienteNome, valorParcela, dataVencimento, senhaTemporaria } = job.data;

    const valor = valorParcela
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorParcela)
      : '';

    const footer = `
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#9ca3af;font-size:12px;text-align:center">
        Lidera — Sistema de Apoio Financeiro<br>
        Para dúvidas, acesse ${PORTAL_URL}
      </p>`;

    switch (job.name) {
      case JOB_EMAIL_LEMBRETE:
        return {
          subject: `Lembrete: parcela de ${valor} vence em ${dataVencimento ?? ''}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <img src="${LOGO_URL}" alt="Lidera" style="height:40px;margin-bottom:24px">
              <h2 style="color:#111827">Lembrete de Vencimento</h2>
              <p>Olá, <strong>${clienteNome}</strong>!</p>
              <p>Sua parcela de <strong>${valor}</strong> vence em <strong>${dataVencimento ?? ''}</strong>.</p>
              <a href="${PORTAL_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">
                Pagar agora
              </a>
              ${footer}
            </div>`,
        };

      case JOB_EMAIL_CONFIRMACAO:
        return {
          subject: `✅ Pagamento de ${valor} confirmado`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <img src="${LOGO_URL}" alt="Lidera" style="height:40px;margin-bottom:24px">
              <h2 style="color:#16a34a">Pagamento Confirmado</h2>
              <p>Olá, <strong>${clienteNome}</strong>!</p>
              <p>Recebemos o seu pagamento de <strong>${valor}</strong>. Obrigado pela pontualidade! 🎉</p>
              <a href="${PORTAL_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">
                Ver extrato
              </a>
              ${footer}
            </div>`,
        };

      case JOB_EMAIL_PORTAL_ATIVADO:
        return {
          subject: 'Seu acesso ao portal Lidera foi ativado',
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <img src="${LOGO_URL}" alt="Lidera" style="height:40px;margin-bottom:24px">
              <h2 style="color:#111827">Bem-vindo ao Portal Lidera!</h2>
              <p>Olá, <strong>${clienteNome}</strong>!</p>
              <p>Seu acesso foi criado. Use a senha temporária abaixo para entrar:</p>
              <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0;text-align:center">
                <span style="font-size:24px;font-weight:bold;letter-spacing:4px">${senhaTemporaria ?? ''}</span>
              </div>
              <p style="color:#ef4444;font-size:14px">⚠️ Troque sua senha imediatamente após o primeiro acesso.</p>
              <a href="${PORTAL_URL}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:16px">
                Acessar portal
              </a>
              ${footer}
            </div>`,
        };

      default:
        return { subject: `Notificação Lidera — ${job.name}`, html: `<p>Olá, ${clienteNome}!</p>` };
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const host = process.env.SMTP_HOST ?? process.env.MAIL_HOST;
    const port = +(process.env.SMTP_PORT ?? process.env.MAIL_PORT ?? 587);
    const user = process.env.SMTP_USER ?? process.env.MAIL_USER;
    const pass = process.env.SMTP_PASS ?? process.env.MAIL_PASS;
    const from = process.env.SMTP_FROM ?? `"Lidera Financeira" <${user ?? ''}>`;

    if (!host || !user || !pass) {
      throw new Error('SMTP não configurado — verifique SMTP_HOST/USER/PASS');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({ from, to, subject, html });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJobData>, error: Error): Promise<void> {
    this.logger.error(`Job ${job.name} (id=${job.id}) falhou definitivamente: ${error.message}`);

    await this.prisma.auditLog.create({
      data: {
        acao: `${job.name.toUpperCase().replace(/\./g, '_')}_FALHOU`,
        entidade: 'queue',
        contexto: {
          jobId: job.id,
          jobName: job.name,
          erro: error.message,
          clientId: job.data.clientId,
          tentativas: job.attemptsMade,
        },
      },
    });
  }
}
