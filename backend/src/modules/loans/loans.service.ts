import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AmortizationType, LoanStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';

import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponse, paginate } from '../../common/dto/paginated-response.dto';
import { CalculatorFactory } from './domain/calculators/calculator.factory';
import { InstallmentSchedule } from './domain/interfaces/installment-calculator.interface';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanFilterDto } from './dto/loan-filter.dto';

// Precisão financeira global — 20 dígitos significativos, arredondamento "meio acima"
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// ─── Tipos internos ──────────────────────────────────────────────────────────

interface RequestContext {
  userId?: number;
  ip?: string;
  userAgent?: string;
}

interface ScheduleResult {
  taxaMensal: Decimal;
  schedule: InstallmentSchedule[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Queries ──────────────────────────────────────────────────────────────

  async findAll(filters: LoanFilterDto): Promise<PaginatedResponse<unknown>> {
    const { page, limit, search, status, clientId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.LoanWhereInput = {};
    if (status) where.status = status as LoanStatus;
    if (clientId) where.clientId = clientId;
    if (search) where.client = { nome: { contains: search } };

    const [data, total] = await Promise.all([
      this.prisma.loan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          client: { select: { id: true, nome: true, nomeSocial: true } },
        },
      }),
      this.prisma.loan.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findById(id: number): Promise<unknown> {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            nome: true,
            nomeSocial: true,
            cpf: true,
            whatsapp: true,
            riskLevel: true,
          },
        },
        installments: { orderBy: { numero: 'asc' } },
      },
    });

    if (!loan) throw new NotFoundException(`Empréstimo ${id} não encontrado`);
    return loan;
  }

  async getStats(): Promise<Record<string, unknown>> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [totalAtivos, totalQuitados, carteiraResult, recebidoMesResult] = await Promise.all([
      this.prisma.loan.count({ where: { status: 'ativo' } }),
      this.prisma.loan.count({ where: { status: 'quitado' } }),
      this.prisma.installment.aggregate({
        where: { status: { in: ['pendente', 'atrasado'] } },
        _sum: { valor: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          dataPagamento: { gte: startOfMonth, lte: endOfMonth },
          estornado: false,
        },
        _sum: { valorPago: true },
      }),
    ]);

    return {
      totalAtivos,
      totalQuitados,
      // Mantemos como string para preservar precisão decimal na serialização JSON
      valorEmCarteira: new Decimal((carteiraResult._sum?.valor ?? '0').toString()).toFixed(2),
      valorRecebidoMes: new Decimal((recebidoMesResult._sum?.valorPago ?? '0').toString()).toFixed(2),
    };
  }

  // ─── Commands ─────────────────────────────────────────────────────────────

  /**
   * Cria um empréstimo com todas as suas parcelas em uma única transação atômica.
   *
   * Garante que nunca existirá um Loan sem Installments no banco de dados.
   */
  async create(dto: CreateLoanDto, ctx: RequestContext = {}): Promise<unknown> {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException(`Cliente ${dto.clientId} não encontrado`);
    if (!client.active) throw new BadRequestException('Cliente inativo não pode contrair empréstimos');

    this.assertRateOrInstallmentProvided(dto);

    const tipoAmortizacao = dto.tipoAmortizacao ?? AmortizationType.simples;
    const { taxaMensal, schedule } = this.buildSchedule(dto, tipoAmortizacao);
    const taxaJurosDecimal = taxaMensal.times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);

    const created = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          clientId: dto.clientId,
          valor: new Decimal(dto.valor).toNumber(),
          valorInvestido: dto.valorInvestido ? new Decimal(dto.valorInvestido).toNumber() : null,
          taxaJuros: taxaJurosDecimal.toNumber(),
          modoTaxa: dto.modoTaxa ?? 'mensal',
          tipoAmortizacao,
          numeroParcelas: dto.numeroParcelas,
          dataInicio: new Date(dto.dataInicio),
          taxaMulta: dto.taxaMulta ?? 2.0,
          taxaMora: dto.taxaMora ?? 1.0,
          periodoCarencia: dto.periodoCarencia ?? 0,
          metodoPagamento: dto.metodoPagamento ?? null,
          observacoes: dto.observacoes ?? null,
          status: 'ativo',
        },
      });

      await tx.installment.createMany({
        data: schedule.map((s) => ({
          loanId: loan.id,
          numero: s.numero,
          valor: s.valor.toNumber(),
          valorPrincipal: s.valorPrincipal.toNumber(),
          valorJuros: s.valorJuros.toNumber(),
          saldoDevedor: s.saldoDevedor.toNumber(),
          dataVencimento: s.dataVencimento,
          status: 'pendente' as const,
          totalPago: 0,
        })),
      });

      await this.writeAuditLog(tx, {
        ...ctx,
        acao: 'LOAN_CREATED',
        entidade: 'Loan',
        entidadeId: loan.id,
        dadosAntes: null,
        dadosDepois: {
          loanId: loan.id,
          clientId: loan.clientId,
          valor: loan.valor.toString(),
          tipoAmortizacao,
          numeroParcelas: loan.numeroParcelas,
          taxaJuros: taxaJurosDecimal.toFixed(4),
          totalParcelas: schedule.length,
          primeiraParcela: schedule[0]?.dataVencimento,
          ultimaParcela: schedule[schedule.length - 1]?.dataVencimento,
        },
      });

      return loan;
    });

    return this.findById(created.id);
  }

  /**
   * Cancela um empréstimo e todas as suas parcelas pendentes/atrasadas atomicamente.
   * Lança ConflictException se o empréstimo já está cancelado ou quitado.
   */
  async cancel(id: number, ctx: RequestContext = {}): Promise<unknown> {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException(`Empréstimo ${id} não encontrado`);

    if (loan.status === 'cancelado') {
      throw new ConflictException('Empréstimo já está cancelado');
    }
    if (loan.status === 'quitado') {
      throw new ConflictException('Empréstimo quitado não pode ser cancelado');
    }

    const snapshotAntes = this.serializeLoan(loan);

    await this.prisma.$transaction(async (tx) => {
      await tx.loan.update({ where: { id }, data: { status: 'cancelado' } });

      await tx.installment.updateMany({
        where: { loanId: id, status: { in: ['pendente', 'atrasado'] } },
        data: { status: 'cancelado' },
      });

      await this.writeAuditLog(tx, {
        ...ctx,
        acao: 'LOAN_CANCELLED',
        entidade: 'Loan',
        entidadeId: id,
        dadosAntes: snapshotAntes,
        dadosDepois: { ...snapshotAntes, status: 'cancelado' },
      });
    });

    return this.findById(id);
  }

  // ─── Private: Business Logic ──────────────────────────────────────────────

  private assertRateOrInstallmentProvided(dto: CreateLoanDto): void {
    const hasRate = dto.taxaJuros !== undefined && dto.taxaJuros !== null;
    const hasInstallment = dto.valorParcela !== undefined && dto.valorParcela !== null && dto.valorParcela > 0;

    if (!hasRate && !hasInstallment) {
      throw new BadRequestException(
        'Informe taxaJuros (%) ou valorParcela (R$). Pelo menos um é obrigatório.',
      );
    }
  }

  private buildSchedule(dto: CreateLoanDto, tipoAmortizacao: AmortizationType): ScheduleResult {
    const principal = new Decimal(dto.valor);
    let taxaMensal: Decimal;

    if (dto.valorParcela && dto.valorParcela > 0) {
      // valorParcela direto só faz sentido para Juros Simples.
      // Price/SAC precisariam de Newton-Raphson para inverter o PMT — não implementado.
      if (tipoAmortizacao !== AmortizationType.simples) {
        throw new BadRequestException(
          'valorParcela direto só é compatível com tipoAmortizacao=simples. ' +
            'Para Price ou SAC, informe taxaJuros.',
        );
      }

      const totalRecebido = new Decimal(dto.valorParcela).times(dto.numeroParcelas);
      const totalJuros = totalRecebido.minus(principal);

      if (totalJuros.isNegative()) {
        throw new BadRequestException(
          'valorParcela × numeroParcelas deve ser maior que o valor do empréstimo.',
        );
      }

      // Taxa mensal implícita pelo método dos juros simples
      taxaMensal = principal.isZero()
        ? new Decimal(0)
        : totalJuros.dividedBy(principal).dividedBy(dto.numeroParcelas);
    } else {
      const taxaBruta = new Decimal(dto.taxaJuros ?? 0).dividedBy(100);
      taxaMensal =
        dto.modoTaxa === 'anual'
          ? taxaBruta.plus(1).pow(new Decimal(1).dividedBy(12)).minus(1)
          : taxaBruta;
    }

    if (taxaMensal.isNegative()) {
      throw new BadRequestException('Taxa de juros não pode ser negativa.');
    }

    const calculator = CalculatorFactory.create(tipoAmortizacao);
    const schedule = calculator.calculate({
      principal,
      taxaMensal,
      numeroParcelas: dto.numeroParcelas,
      dataInicio: new Date(dto.dataInicio),
    });

    return { taxaMensal, schedule };
  }

  // ─── Private: Audit ───────────────────────────────────────────────────────

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    params: RequestContext & {
      acao: string;
      entidade: string;
      entidadeId: number;
      dadosAntes: Record<string, unknown> | null;
      dadosDepois: Record<string, unknown>;
    },
  ): Promise<void> {
    const { userId, ip, userAgent, acao, entidade, entidadeId, dadosAntes, dadosDepois } = params;

    // Hash SHA-256 para detecção de adulteração do log de auditoria
    const hash = createHash('sha256')
      .update(
        JSON.stringify({ userId, acao, entidade, entidadeId, dadosDepois, ts: Date.now() }),
      )
      .digest('hex');

    await tx.auditLog.create({
      data: {
        userId: userId ?? null,
        acao,
        entidade,
        entidadeId,
        dadosAntes: (dadosAntes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        dadosDepois: dadosDepois as Prisma.InputJsonValue,
        hash,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
  }

  private serializeLoan(loan: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(loan).map(([k, v]) => [
        k,
        v instanceof Decimal ? v.toString() : v,
      ]),
    );
  }
}
