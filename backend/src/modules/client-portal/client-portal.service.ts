import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyInfo(userId: number): Promise<unknown> {
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        cpf: true,
        email: true,
        whatsapp: true,
        telefone: true,
        endereco: true,
        cidade: true,
        estado: true,
      },
    });
    if (!client) throw new NotFoundException('Dados do cliente não encontrados');
    return client;
  }

  async getMyLoans(userId: number): Promise<unknown> {
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');

    return this.prisma.loan.findMany({
      where: { clientId: client.id },
      include: {
        installments: {
          orderBy: { numero: 'asc' },
          where: { status: { not: 'cancelado' } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyInstallments(userId: number): Promise<unknown> {
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
    });
    if (!client) throw new ForbiddenException();

    return this.prisma.installment.findMany({
      where: {
        loan: { clientId: client.id },
        status: { not: 'cancelado' },
      },
      include: {
        loan: { select: { id: true, valor: true } },
        payments: { orderBy: { dataPagamento: 'desc' } },
      },
      orderBy: [{ status: 'asc' }, { dataVencimento: 'asc' }],
    });
  }

  async getMyTickets(userId: number): Promise<unknown> {
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
    });
    if (!client) throw new ForbiddenException();

    return this.prisma.supportTicket.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTicket(
    userId: number,
    assunto: string,
    mensagem: string,
  ): Promise<unknown> {
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
    });
    if (!client) throw new ForbiddenException();

    return this.prisma.supportTicket.create({
      data: { clientId: client.id, assunto, mensagem },
    });
  }
}
