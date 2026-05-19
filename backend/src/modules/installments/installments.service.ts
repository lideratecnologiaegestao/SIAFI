import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InstallmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByLoan(loanId: number): Promise<unknown[]> {
    return this.prisma.installment.findMany({
      where: { loanId },
      orderBy: { numero: 'asc' },
      include: {
        payments: { orderBy: { dataPagamento: 'desc' } },
      },
    });
  }

  async findById(id: number): Promise<unknown> {
    const installment = await this.prisma.installment.findUnique({
      where: { id },
      include: {
        payments: { orderBy: { dataPagamento: 'desc' } },
        loan: {
          include: {
            client: { select: { id: true, nome: true, cpf: true } },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundException(`Parcela com id ${id} não encontrada`);
    }

    return installment;
  }

  async findOverdue(): Promise<unknown[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.prisma.installment.findMany({
      where: {
        status: 'pendente',
        dataVencimento: { lt: today },
      },
      orderBy: { dataVencimento: 'asc' },
      include: {
        loan: {
          include: {
            client: { select: { id: true, nome: true, whatsapp: true } },
          },
        },
      },
    });
  }

  async markOverdue(): Promise<{ count: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.installment.updateMany({
      where: {
        status: 'pendente',
        dataVencimento: { lt: today },
      },
      data: { status: 'atrasado' },
    });

    return { count: result.count };
  }
}
