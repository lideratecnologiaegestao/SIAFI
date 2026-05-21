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

  // Calcula e persiste valorMulta/valorMora em todas as parcelas em atraso.
  // Executado diariamente pelo cron. Multa: aplicada uma vez ao atrasar.
  // Mora: recalculada a cada execução (proporcional aos dias de atraso).
  async markOverdue(): Promise<{ count: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const atrasadas = await this.prisma.installment.findMany({
      where: {
        status: { in: ['pendente', 'atrasado'] },
        dataVencimento: { lt: today },
      },
      select: {
        id: true,
        status: true,
        installmentAmount: true,
        totalPago: true,
        valorMulta: true,
        dataVencimento: true,
        loan: { select: { taxaMulta: true, taxaMora: true } },
      },
    });

    for (const inst of atrasadas) {
      const venc = new Date(inst.dataVencimento);
      venc.setHours(0, 0, 0, 0);
      const diasAtraso = Math.floor(
        (today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24),
      );

      const saldo = Math.max(0, Number(inst.installmentAmount) - Number(inst.totalPago));
      const taxaMulta = Number(inst.loan.taxaMulta) / 100;
      const taxaMora = Number(inst.loan.taxaMora) / 100;

      // Multa: one-time ao entrar em atraso (mantém valor se já foi calculada)
      const valorMulta =
        inst.status === 'pendente'
          ? parseFloat((saldo * taxaMulta).toFixed(2))
          : Number(inst.valorMulta);

      // Mora: cresce diariamente (% ao mês proporcional aos dias)
      const valorMora = parseFloat(
        ((saldo * taxaMora * diasAtraso) / 30).toFixed(2),
      );

      await this.prisma.installment.update({
        where: { id: inst.id },
        data: { status: 'atrasado', valorMulta, valorMora },
      });
    }

    return { count: atrasadas.length };
  }

  // Retorna encargos recalculados em tempo real para exibição ao operador.
  async getEncargos(id: number): Promise<{
    valor: number;
    totalPago: number;
    valorMulta: number;
    valorMora: number;
    totalDevido: number;
    diasAtraso: number;
  }> {
    const inst = await this.prisma.installment.findUnique({
      where: { id },
      select: {
        installmentAmount: true,
        totalPago: true,
        valorMulta: true,
        valorMora: true,
        dataVencimento: true,
        status: true,
        loan: { select: { taxaMulta: true, taxaMora: true } },
      },
    });

    if (!inst) throw new NotFoundException(`Parcela ${id} não encontrada`);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const venc = new Date(inst.dataVencimento);
    venc.setHours(0, 0, 0, 0);

    const diasAtraso = inst.status === 'atrasado'
      ? Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    const saldo = Math.max(0, Number(inst.installmentAmount) - Number(inst.totalPago));
    const taxaMora = Number(inst.loan.taxaMora) / 100;

    // Usa multa já armazenada; recalcula mora em tempo real
    const valorMulta = Number(inst.valorMulta);
    const valorMora = diasAtraso > 0
      ? parseFloat(((saldo * taxaMora * diasAtraso) / 30).toFixed(2))
      : 0;

    return {
      valor: Number(inst.installmentAmount),
      totalPago: Number(inst.totalPago),
      valorMulta,
      valorMora,
      totalDevido: Number(inst.installmentAmount) + valorMulta + valorMora,
      diasAtraso,
    };
  }
}
