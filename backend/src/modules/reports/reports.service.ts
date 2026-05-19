import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMovimentacao(startDate: string, endDate: string): Promise<unknown> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const [transactions, payments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { data: { gte: start, lte: end } },
        orderBy: { data: 'desc' },
        include: { user: { select: { nome: true } } },
      }),
      this.prisma.payment.findMany({
        where: { dataPagamento: { gte: start, lte: end } },
        orderBy: { dataPagamento: 'desc' },
        include: {
          installment: {
            include: {
              loan: { include: { client: { select: { nome: true } } } },
            },
          },
        },
      }),
    ]);

    const entradas = transactions
      .filter((t) => t.tipo === 'entrada')
      .reduce((s, t) => s + Number(t.valor), 0);
    const saidas = transactions
      .filter((t) => t.tipo === 'saida')
      .reduce((s, t) => s + Number(t.valor), 0);
    const totalPagamentos = payments.reduce(
      (s, p) => s + Number(p.valorPago),
      0,
    );

    return {
      transactions,
      payments,
      summary: { entradas, saidas, saldo: entradas - saidas, totalPagamentos },
    };
  }

  async getCarteira(): Promise<unknown> {
    const [emprestimosAtivos, totalRecebido, aReceber, totalAtrasados, totalAtivosCount] =
      await Promise.all([
        // Active loans for valorInvestido and valorTotalParcelado
        this.prisma.loan.findMany({
          where: { status: 'ativo' },
          select: { valor: true, valorInvestido: true },
        }),
        // Total received (all payments ever)
        this.prisma.payment.aggregate({ _sum: { valorPago: true } }),
        // Pending/overdue installments = a receber
        this.prisma.installment.aggregate({
          where: { status: { in: ['pendente', 'atrasado'] } },
          _sum: { valor: true },
        }),
        // Overdue loans count
        this.prisma.loan.count({
          where: {
            status: 'ativo',
            installments: { some: { status: 'atrasado' } },
          },
        }),
        // Active loans count
        this.prisma.loan.count({ where: { status: 'ativo' } }),
      ]);

    const valorInvestido = emprestimosAtivos.reduce(
      (s, l) => s + Number(l.valorInvestido ?? l.valor),
      0,
    );

    // Total parcelado = sum of all installments for active loans
    const valorTotalParcelado_result = await this.prisma.installment.aggregate({
      where: { loan: { status: 'ativo' } },
      _sum: { valor: true },
    });

    const valorTotalParcelado = Number(valorTotalParcelado_result._sum.valor ?? 0);
    const valorRecebido = Number(totalRecebido._sum.valorPago ?? 0);
    const aReceberVal = Number(aReceber._sum.valor ?? 0);

    return {
      valorInvestido,
      valorTotalParcelado,
      valorRecebido,
      aReceber: aReceberVal,
      totalAtivos: totalAtivosCount,
      totalAtrasados,
    };
  }

  async getClientes(): Promise<unknown> {
    const clientes = await this.prisma.client.findMany({
      where: { active: true },
      include: {
        loans: {
          where: { status: 'ativo' },
          include: {
            installments: {
              where: { status: { in: ['pendente', 'atrasado'] } },
              orderBy: { dataVencimento: 'asc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return clientes.map((c) => ({
      id: c.id,
      nome: c.nome,
      cpf: c.cpf,
      whatsapp: c.whatsapp,
      emprestimosAtivos: c.loans.length,
      proximaParcela: c.loans[0]?.installments[0] ?? null,
    }));
  }

  async getContratos(status?: string): Promise<unknown> {
    const where = status
      ? {
          status: status as
            | 'ativo'
            | 'quitado'
            | 'cancelado'
            | 'inadimplente',
        }
      : {};
    return this.prisma.loan.findMany({
      where,
      include: {
        client: { select: { nome: true, cpf: true, whatsapp: true } },
        _count: { select: { installments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
