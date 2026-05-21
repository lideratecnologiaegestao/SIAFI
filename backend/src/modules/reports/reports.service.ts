import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

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
    const totalPagamentos = payments.reduce((s, p) => s + Number(p.valorPago), 0);

    return {
      transactions,
      payments,
      summary: { entradas, saidas, saldo: entradas - saidas, totalPagamentos },
    };
  }

  async getCarteira(): Promise<unknown> {
    const [loansAtivos, parcelasPagas, parcelasPendentes, totalAtrasados, totalAtivosCount] =
      await Promise.all([
        this.prisma.loan.findMany({
          where: { status: 'ativo' },
          select: { principalAmount: true, targetProfit: true, totalReceivable: true },
        }),
        this.prisma.installment.findMany({
          where: { status: 'pago' },
          select: { installmentAmount: true, principalPayback: true, netGain: true },
        }),
        this.prisma.installment.findMany({
          where: { status: { in: ['pendente', 'atrasado'] } },
          select: { installmentAmount: true },
        }),
        this.prisma.loan.count({
          where: {
            status: 'ativo',
            installments: { some: { status: 'atrasado' } },
          },
        }),
        this.prisma.loan.count({ where: { status: 'ativo' } }),
      ]);

    // Capital
    const principalEmCarteira = loansAtivos.reduce(
      (acc, l) => acc.plus(l.principalAmount.toString()), new Decimal(0),
    );
    const principalRecuperado = parcelasPagas.reduce(
      (acc, i) => acc.plus(i.principalPayback.toString()), new Decimal(0),
    );
    const principalARecuperar = principalEmCarteira.minus(principalRecuperado);

    // Faturamento
    const targetProfitEmCarteira = loansAtivos.reduce(
      (acc, l) => acc.plus(l.targetProfit.toString()), new Decimal(0),
    );
    const faturamentoRealizado = parcelasPagas.reduce(
      (acc, i) => acc.plus(i.netGain.toString()), new Decimal(0),
    );
    const faturamentoAReceber = targetProfitEmCarteira.minus(faturamentoRealizado);

    // Totais operacionais (manter para compatibilidade com dashboard)
    const totalReceivableAtivo = loansAtivos.reduce(
      (acc, l) => acc.plus(l.totalReceivable.toString()), new Decimal(0),
    );
    const totalRecebido = parcelasPagas.reduce(
      (acc, i) => acc.plus(i.installmentAmount.toString()), new Decimal(0),
    );
    const aReceber = parcelasPendentes.reduce(
      (acc, i) => acc.plus(i.installmentAmount.toString()), new Decimal(0),
    );

    return {
      // Capital
      principalEmCarteira:    principalEmCarteira.toFixed(2),
      principalRecuperado:    principalRecuperado.toFixed(2),
      principalARecuperar:    principalARecuperar.toFixed(2),
      // Faturamento
      targetProfitEmCarteira: targetProfitEmCarteira.toFixed(2),
      faturamentoRealizado:   faturamentoRealizado.toFixed(2),
      faturamentoAReceber:    faturamentoAReceber.toFixed(2),
      // Totais operacionais
      totalReceivableAtivo:   totalReceivableAtivo.toFixed(2),
      totalRecebido:          totalRecebido.toFixed(2),
      aReceber:               aReceber.toFixed(2),
      totalAtivos:            totalAtivosCount,
      totalAtrasados,
    };
  }

  async getFaturamentoMensal(mes: string): Promise<unknown> {
    const inicio = new Date(mes + '-01T00:00:00.000Z');
    const fim    = new Date(
      new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0, 23, 59, 59, 999).toISOString(),
    );

    const parcelasPagas = await this.prisma.installment.findMany({
      where: {
        status: 'pago',
        updatedAt: { gte: inicio, lte: fim },
      },
      select: {
        id:                true,
        installmentAmount: true,
        principalPayback:  true,
        netGain:           true,
        loan: {
          select: {
            id:             true,
            principalAmount: true,
            targetProfit:   true,
            consultor: { select: { id: true, nome: true } },
          },
        },
      },
    });

    const faturamentoBruto   = parcelasPagas.reduce(
      (acc, p) => acc.plus(p.netGain.toString()), new Decimal(0),
    );
    const recuperacaoCapital = parcelasPagas.reduce(
      (acc, p) => acc.plus(p.principalPayback.toString()), new Decimal(0),
    );
    const totalRecebido      = parcelasPagas.reduce(
      (acc, p) => acc.plus(p.installmentAmount.toString()), new Decimal(0),
    );

    // Breakdown por consultor
    const porConsultor = this.agruparPorConsultor(parcelasPagas);

    return {
      mes,
      totalRecebido:      totalRecebido.toFixed(2),
      faturamentoBruto:   faturamentoBruto.toFixed(2),
      recuperacaoCapital: recuperacaoCapital.toFixed(2),
      quantidadeParcelas: parcelasPagas.length,
      porConsultor,
    };
  }

  private agruparPorConsultor(
    parcelas: Array<{
      netGain: { toString(): string };
      loan: { consultor: { id: number; nome: string } | null };
    }>,
  ) {
    const mapa = new Map<number, { id: number; nome: string; faturamento: Decimal; quantidade: number }>();

    for (const p of parcelas) {
      if (!p.loan.consultor) continue;
      const { id, nome } = p.loan.consultor;
      const entrada = mapa.get(id) ?? { id, nome, faturamento: new Decimal(0), quantidade: 0 };
      entrada.faturamento = entrada.faturamento.plus(p.netGain.toString());
      entrada.quantidade += 1;
      mapa.set(id, entrada);
    }

    return Array.from(mapa.values()).map((c) => ({
      consultorId:  c.id,
      consultorNome: c.nome,
      quantidade:   c.quantidade,
      faturamento:  c.faturamento.toFixed(2),
    }));
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
      ? { status: status as 'ativo' | 'quitado' | 'cancelado' | 'inadimplente' }
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
