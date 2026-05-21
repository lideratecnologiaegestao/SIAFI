import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { LoanStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';

import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponse, paginate } from '../../common/dto/paginated-response.dto';
import { addMonthsSafe, calcularDataVencimento } from '../../common/utils/date.utils';
import { CreateLoanDto } from './dto/create-loan.dto';
import { LoanFilterDto } from './dto/loan-filter.dto';

// Precisão financeira global — 20 dígitos significativos, arredondamento "meio acima"
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface RequestContext {
  userId?: number;
  ip?: string;
  userAgent?: string;
  loanStatus?: LoanStatus;   // padrão: 'ativo'; use 'aguardando_aceite' quando chamado via IntencaoService
  aceiteExpiraEm?: Date;     // apenas quando loanStatus = 'aguardando_aceite'
}

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Queries ────────────────────────────────────────────────────────────────

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
        consultor: { select: { id: true, nome: true } },
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
        _sum: { installmentAmount: true },
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
      valorEmCarteira: new Decimal(
        (carteiraResult._sum?.installmentAmount ?? '0').toString(),
      ).toFixed(2),
      valorRecebidoMes: new Decimal(
        (recebidoMesResult._sum?.valorPago ?? '0').toString(),
      ).toFixed(2),
    };
  }

  // ─── Commands ───────────────────────────────────────────────────────────────

  async create(dto: CreateLoanDto, ctx: RequestContext = {}): Promise<unknown> {
    const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException(`Cliente ${dto.clientId} não encontrado`);
    if (!client.active) throw new BadRequestException('Cliente inativo não pode contrair empréstimos');

    const principal = new Decimal(dto.principalAmount);
    const profit    = new Decimal(dto.targetProfit);
    const n         = dto.numeroParcelas;
    const total     = principal.plus(profit);

    if (principal.lte(0)) throw new BadRequestException('principalAmount deve ser positivo.');
    if (profit.lt(0))     throw new BadRequestException('targetProfit não pode ser negativo.');

    // ── Cálculo base de cada parcela (floor para evitar exceder o total) ────
    const baseInstallment = total.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const basePrincipal   = principal.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    const baseGain        = profit.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);

    // ── Ajustes de centavos para a última parcela ───────────────────────────
    const ajusteInstallment = total.minus(baseInstallment.times(n));
    const ajustePrincipal   = principal.minus(basePrincipal.times(n));
    const ajusteGain        = profit.minus(baseGain.times(n));

    // Verificação de integridade: ajusteInstallment = ajustePrincipal + ajusteGain
    if (!ajustePrincipal.plus(ajusteGain).equals(ajusteInstallment)) {
      throw new InternalServerErrorException(
        'Erro de integridade no cálculo de split: ajuste de centavos inconsistente.',
      );
    }

    // ── Geração das parcelas ────────────────────────────────────────────────
    const installments = Array.from({ length: n }, (_, i) => {
      const isUltima       = i === n - 1;
      const installAmt     = isUltima ? baseInstallment.plus(ajusteInstallment) : baseInstallment;
      const principalPay   = isUltima ? basePrincipal.plus(ajustePrincipal)     : basePrincipal;
      const gain           = isUltima ? baseGain.plus(ajusteGain)               : baseGain;

      if (!installAmt.equals(principalPay.plus(gain))) {
        throw new InternalServerErrorException(
          `Invariante violada na parcela ${i + 1}: ` +
          `${installAmt} !== ${principalPay} + ${gain}`,
        );
      }

      const amt = installAmt.toDecimalPlaces(2).toNumber();
      return {
        numero:            i + 1,
        installmentAmount: amt,
        principalPayback:  principalPay.toDecimalPlaces(2).toNumber(),
        netGain:           gain.toDecimalPlaces(2).toNumber(),
        dataVencimento:    calcularDataVencimento(new Date(dto.dataInicio), i + 1, dto.diaVencimento),
        status:            'pendente' as const,
        totalPago:         0,
        saldoDevedor:      amt,
        valorMulta:        0,
        valorMora:         0,
      };
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.create({
        data: {
          clientId:                dto.clientId,
          consultorId:             ctx.userId ?? null,
          principalAmount:         principal.toDecimalPlaces(2).toNumber(),
          targetProfit:            profit.toDecimalPlaces(2).toNumber(),
          totalReceivable:         total.toDecimalPlaces(2).toNumber(),
          numeroParcelas:          n,
          metodoPagamento:         dto.metodoPagamento ?? null,
          dataInicio:              new Date(dto.dataInicio),
          observacoes:             dto.observacoes ?? null,
          status:                  ctx.loanStatus ?? 'ativo',
          aceiteExpiraEm:          ctx.aceiteExpiraEm ?? null,
          diaVencimento:           dto.diaVencimento ?? null,
          multaPercentual:         dto.multaPercentual ?? null,
          moraDiariaPercentual:    dto.moraDiariaPercentual ?? null,
          diasAntecedenciaCobranca: dto.diasAntecedenciaCobranca ?? 10,
          cobrarWhatsapp:          dto.cobrarWhatsapp ?? true,
          cobrarEmail:             dto.cobrarEmail ?? true,
          cobrarPortal:            dto.cobrarPortal ?? true,
        },
      });

      await tx.installment.createMany({
        data: installments.map((inst) => ({ ...inst, loanId: loan.id })),
      });

      await this.writeAuditLog(tx, {
        ...ctx,
        acao:       'LOAN_CREATED',
        entidade:   'Loan',
        entidadeId: loan.id,
        dadosAntes: null,
        dadosDepois: {
          loanId:           loan.id,
          clientId:         loan.clientId,
          principalAmount:  principal.toString(),
          targetProfit:     profit.toString(),
          totalReceivable:  total.toString(),
          numeroParcelas:   n,
          baseInstallment:  baseInstallment.toString(),
          basePrincipal:    basePrincipal.toString(),
          baseGain:         baseGain.toString(),
          ajusteInstallment: ajusteInstallment.toString(),
          primeiraParcela:  installments[0]?.dataVencimento,
          ultimaParcela:    installments[installments.length - 1]?.dataVencimento,
        },
      });

      return loan;
    });

    return this.findById(created.id);
  }

  async cancel(id: number, ctx: RequestContext = {}): Promise<unknown> {
    const loan = await this.prisma.loan.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException(`Empréstimo ${id} não encontrado`);

    if (loan.status === 'cancelado') throw new ConflictException('Empréstimo já está cancelado');
    if (loan.status === 'quitado')   throw new ConflictException('Empréstimo quitado não pode ser cancelado');

    const snapshotAntes = this.serializeLoan(loan);

    await this.prisma.$transaction(async (tx) => {
      await tx.loan.update({ where: { id }, data: { status: 'cancelado' } });

      await tx.installment.updateMany({
        where: { loanId: id, status: { in: ['pendente', 'atrasado'] } },
        data: { status: 'cancelado' },
      });

      await this.writeAuditLog(tx, {
        ...ctx,
        acao:       'LOAN_CANCELLED',
        entidade:   'Loan',
        entidadeId: id,
        dadosAntes:  snapshotAntes,
        dadosDepois: { ...snapshotAntes, status: 'cancelado' },
      });
    });

    return this.findById(id);
  }

  // ─── Liberações pendentes ────────────────────────────────────────────────────

  async findPendentesLiberacao(): Promise<unknown[]> {
    return this.prisma.loan.findMany({
      where: { status: 'aguardando_liberacao' },
      include: {
        client: { select: { id: true, nome: true, nomeSocial: true } },
      },
      orderBy: { aceiteClienteEm: 'asc' },
    });
  }

  // ─── Liberação manual de capital ────────────────────────────────────────────

  async liberarCapital(
    loanId: number,
    dto: { metodoLiberacao: string; dataLiberacao?: string; observacao?: string },
    ctx: RequestContext = {},
  ): Promise<unknown> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { client: { select: { id: true, nome: true, whatsapp: true } } },
    });

    if (!loan) throw new NotFoundException(`Empréstimo ${loanId} não encontrado`);
    if (loan.status !== 'aguardando_liberacao') {
      throw new BadRequestException('Contrato não está aguardando liberação de capital.');
    }

    const dataLib = dto.dataLiberacao ? new Date(dto.dataLiberacao) : new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Ativar o contrato
      await tx.loan.update({
        where: { id: loanId },
        data: {
          status:          'ativo',
          dataInicio:      dataLib,
          liberadoPor:     ctx.userId ?? null,
          liberadoEm:      dataLib,
          metodoLiberacao: dto.metodoLiberacao,
        },
      });

      // 2. Reajustar datas de vencimento das parcelas pendentes (data provisória → data real)
      const installments = await tx.installment.findMany({
        where:   { loanId, status: 'pendente' },
        orderBy: { numero: 'asc' },
        select:  { id: true, numero: true },
      });
      for (const inst of installments) {
        await tx.installment.update({
          where: { id: inst.id },
          data:  { dataVencimento: addMonthsSafe(dataLib, inst.numero) },
        });
      }

      // 3. Registrar saída no caixa
      await tx.transaction.create({
        data: {
          tipo:      'saida',
          valor:     loan.principalAmount,
          descricao: `Liberação de capital — Contrato #${loanId} · ${loan.client.nome}${dto.observacao ? ` — ${dto.observacao}` : ''}`,
          categoria: 'Liberação de Empréstimo',
          data:      dataLib,
          userId:    ctx.userId ?? null,
        },
      });

      // 4. AuditLog
      await this.writeAuditLog(tx, {
        ...ctx,
        acao:       'CAPITAL_LIBERADO',
        entidade:   'Loan',
        entidadeId: loanId,
        dadosAntes:  { status: 'aguardando_liberacao' },
        dadosDepois: {
          status:          'ativo',
          metodo:          dto.metodoLiberacao,
          valor:           loan.principalAmount.toString(),
          dataLib:         dataLib.toISOString(),
          clientId:        loan.clientId,
          parcelasAjustadas: installments.length,
        },
      });
    });

    return this.findById(loanId);
  }

  // ─── Utilitário de integridade ───────────────────────────────────────────────

  async verificarIntegridadeLoan(loanId: number): Promise<{
    integro: boolean;
    divergencias: string[];
  }> {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: { installments: true },
    });

    if (!loan) throw new NotFoundException(`Empréstimo ${loanId} não encontrado`);

    const divergencias: string[] = [];
    const total         = new Decimal(loan.totalReceivable.toString());
    const principal     = new Decimal(loan.principalAmount.toString());
    const profit        = new Decimal(loan.targetProfit.toString());

    const somaInstallments = loan.installments.reduce(
      (acc, i) => acc.plus(i.installmentAmount.toString()),
      new Decimal(0),
    );
    const somaPrincipal = loan.installments.reduce(
      (acc, i) => acc.plus(i.principalPayback.toString()),
      new Decimal(0),
    );
    const somaGain = loan.installments.reduce(
      (acc, i) => acc.plus(i.netGain.toString()),
      new Decimal(0),
    );

    if (!total.equals(principal.plus(profit)))
      divergencias.push(`totalReceivable (${total}) ≠ principalAmount + targetProfit (${principal.plus(profit)})`);

    if (!somaInstallments.equals(total))
      divergencias.push(`Soma installmentAmount (${somaInstallments}) ≠ totalReceivable (${total})`);

    if (!somaPrincipal.equals(principal))
      divergencias.push(`Soma principalPayback (${somaPrincipal}) ≠ principalAmount (${principal})`);

    if (!somaGain.equals(profit))
      divergencias.push(`Soma netGain (${somaGain}) ≠ targetProfit (${profit})`);

    return { integro: divergencias.length === 0, divergencias };
  }

  // ─── Private: Audit ─────────────────────────────────────────────────────────

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

    const hash = createHash('sha256')
      .update(JSON.stringify({ userId, acao, entidade, entidadeId, dadosDepois, ts: Date.now() }))
      .digest('hex');

    await tx.auditLog.create({
      data: {
        userId:     userId ?? null,
        acao,
        entidade,
        entidadeId,
        dadosAntes:  (dadosAntes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        dadosDepois: dadosDepois as Prisma.InputJsonValue,
        hash,
        ip:        ip ?? null,
        userAgent: userAgent ?? null,
      },
    });
  }

  private serializeLoan(loan: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(loan).map(([k, v]) => [k, v instanceof Decimal ? v.toString() : v]),
    );
  }
}
