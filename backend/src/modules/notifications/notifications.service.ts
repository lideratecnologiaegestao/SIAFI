import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';

interface LogNotificationData {
  clientId: number;
  loanId?: number;
  tipo: string;
  assunto?: string;
  mensagem: string;
  status: 'enviado' | 'erro' | 'pendente';
}

export interface NotificationList {
  data: {
    id: number;
    clientId: number;
    loanId: number | null;
    tipo: string;
    assunto: string | null;
    mensagem: string;
    status: string;
    sentAt: Date | null;
    createdAt: Date;
    client: { nome: string };
  }[];
  meta: {
    total: number;
    page: number;
    limit: number;
    lastPage: number;
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendWhatsApp(phone: string, message: string): Promise<boolean> {
    const apiUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const instance = process.env.WHATSAPP_INSTANCE;

    if (!apiUrl || !apiKey || !instance) {
      this.logger.warn('WhatsApp not configured, skipping');
      return false;
    }

    const phoneClean = phone.replace(/\D/g, '');
    const phoneWithCountry = phoneClean.startsWith('55') ? phoneClean : `55${phoneClean}`;

    try {
      await axios.post(
        `${apiUrl}/message/sendText/${instance}`,
        { number: phoneWithCountry, text: message },
        { headers: { apikey: apiKey }, timeout: 10000 },
      );
      return true;
    } catch (err) {
      this.logger.error(`WhatsApp send failed to ${phone}`, err);
      return false;
    }
  }

  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    const host = process.env.MAIL_HOST;
    const port = Number(process.env.MAIL_PORT ?? 587);
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    const fromName = process.env.MAIL_FROM_NAME ?? 'SIAFI';

    if (!host || !user || !pass) {
      this.logger.warn('Email not configured, skipping');
      return false;
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from: `"${fromName}" <${user}>`,
        to,
        subject,
        html,
      });
      return true;
    } catch (err) {
      this.logger.error(`Email send failed to ${to}`, err);
      return false;
    }
  }

  async logNotification(data: LogNotificationData): Promise<void> {
    await this.prisma.notification.create({
      data: {
        clientId: data.clientId,
        loanId: data.loanId ?? null,
        tipo: data.tipo,
        assunto: data.assunto ?? null,
        mensagem: data.mensagem,
        status: data.status,
        sentAt: data.status === 'enviado' ? new Date() : null,
      },
    });
  }

  async notifyOverdue(installmentId: number): Promise<void> {
    const installment = await this.prisma.installment.findUnique({
      where: { id: installmentId },
      include: {
        loan: {
          include: {
            client: { select: { id: true, nome: true, whatsapp: true, email: true } },
          },
        },
      },
    });

    if (!installment) return;

    const client = installment.loan.client;

    const dtVenc = new Intl.DateTimeFormat('pt-BR').format(new Date(installment.dataVencimento));
    const valor = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(installment.valor),
    );

    const message =
      `Olá ${client.nome}! ` +
      `Sua parcela #${installment.numero} no valor de ${valor}, ` +
      `vencida em ${dtVenc}, está em aberto. ` +
      `Entre em contato para regularizar. SIAFI`;

    let sent = false;

    if (client.whatsapp) {
      sent = await this.sendWhatsApp(client.whatsapp, message);
    }

    await this.logNotification({
      clientId: client.id,
      loanId: installment.loanId,
      tipo: 'whatsapp',
      assunto: `Parcela #${installment.numero} vencida`,
      mensagem: message,
      status: sent ? 'enviado' : 'erro',
    });

    if (client.email) {
      const html = `
        <h2>Parcela em Atraso — SIAFI</h2>
        <p>Olá, <strong>${client.nome}</strong>!</p>
        <p>Sua parcela <strong>#${installment.numero}</strong> no valor de <strong>${valor}</strong>,
        com vencimento em <strong>${dtVenc}</strong>, está em aberto.</p>
        <p>Entre em contato para regularizar sua situação.</p>
        <hr><p style="color:#666;font-size:12px">SIAFI — Sistema Integrado de Apoio Financeiro</p>
      `;

      const emailSent = await this.sendEmail(
        client.email,
        `Parcela #${installment.numero} em atraso — SIAFI`,
        html,
      );

      await this.logNotification({
        clientId: client.id,
        loanId: installment.loanId,
        tipo: 'email',
        assunto: `Parcela #${installment.numero} vencida`,
        mensagem: message,
        status: emailSent ? 'enviado' : 'erro',
      });
    }
  }

  async findAll(page = 1, limit = 20, clientId?: number): Promise<NotificationList> {
    const skip = (page - 1) * limit;
    const where = clientId ? { clientId } : {};

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { client: { select: { nome: true } } },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, lastPage: Math.ceil(total / limit) },
    };
  }
}
