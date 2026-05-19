import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRenegociacaoDto } from './dto/create-renegociacao.dto';

@Injectable()
export class RenegociacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<unknown[]> {
    return this.prisma.renegociacao.findMany({
      include: { loan: { include: { client: { select: { id: true, nome: true, cpf: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByLoan(loanId: number): Promise<unknown[]> {
    return this.prisma.renegociacao.findMany({
      where: { loanId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(dto: CreateRenegociacaoDto): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: dto.loanId },
        include: {
          installments: {
            where: { status: { in: ['pendente', 'atrasado'] } },
            orderBy: { numero: 'asc' },
          },
        },
      });

      if (!loan) throw new NotFoundException(`Empréstimo ${dto.loanId} não encontrado`);
      if (loan.status !== 'ativo')
        throw new BadRequestException('Apenas empréstimos ativos podem ser renegociados');
      if (loan.installments.length === 0)
        throw new BadRequestException('Nenhuma parcela pendente ou atrasada para renegociar');

      const saldoDevedor = loan.installments.reduce((acc, inst) => {
        return acc + (Number(inst.valor) - Number(inst.totalPago));
      }, 0);

      const installmentIds = loan.installments.map((i) => i.id);
      await tx.installment.updateMany({
        where: { id: { in: installmentIds } },
        data: { status: 'cancelado' },
      });

      const taxaMensal = dto.taxaJuros / 100;
      const totalComJuros = saldoDevedor * (1 + taxaMensal * dto.numeroParcelas);
      const valorParcela = Math.round((totalComJuros / dto.numeroParcelas) * 100) / 100;

      const currentMaxNumero = await tx.installment.aggregate({
        where: { loanId: dto.loanId },
        _max: { numero: true },
      });
      const baseNumero = (currentMaxNumero._max.numero ?? 0) + 1;

      const newInstallments = Array.from({ length: dto.numeroParcelas }, (_, i) => {
        const dataVencimento = new Date(dto.dataInicio);
        dataVencimento.setMonth(dataVencimento.getMonth() + i);
        return {
          loanId: dto.loanId,
          numero: baseNumero + i,
          valor: valorParcela,
          dataVencimento,
          status: 'pendente' as const,
          totalPago: 0,
        };
      });

      await tx.installment.createMany({ data: newInstallments });

      const renegociacao = await tx.renegociacao.create({
        data: {
          loanId: dto.loanId,
          valorTotal: Math.round(totalComJuros * 100) / 100,
          numeroParcelas: dto.numeroParcelas,
          taxaJuros: dto.taxaJuros,
          dataInicio: new Date(dto.dataInicio),
          observacoes: dto.observacoes ?? null,
        },
      });

      return {
        renegociacao,
        saldoRenegociado: Math.round(saldoDevedor * 100) / 100,
        parcelasNovosValor: valorParcela,
        parcelasAntigasCanceladas: installmentIds.length,
      };
    });
  }
}
