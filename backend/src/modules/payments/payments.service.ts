import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoreRiscoService } from '../score-risco/score-risco.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoreRisco: ScoreRiscoService,
  ) {}

  async create(dto: CreatePaymentDto, userId?: number): Promise<unknown> {
    const payment = await this.prisma.$transaction(async (tx) => {
      // 1. Buscar parcela com loan e client
      const installment = await tx.installment.findUnique({
        where: { id: dto.installmentId },
        include: {
          loan: {
            include: {
              client: { select: { id: true, nome: true } },
            },
          },
        },
      });

      if (!installment) {
        throw new NotFoundException(`Parcela com id ${dto.installmentId} não encontrada`);
      }

      if (installment.status === 'pago' || installment.status === 'cancelado') {
        throw new BadRequestException(`Parcela já está ${installment.status}.`);
      }

      const valorPago         = new Decimal(dto.valorPago.toString());
      const installmentAmount = new Decimal(installment.installmentAmount.toString());
      const moraAcumulada     = new Decimal(installment.moraAcumulada.toString());
      const totalPagoAnt      = new Decimal(installment.totalPago.toString());
      const novoTotalPago     = totalPagoAnt.plus(valorPago);
      const limiteMaximo      = installmentAmount.plus(moraAcumulada);

      if (valorPago.lte(0)) {
        throw new BadRequestException('Valor do pagamento deve ser positivo.');
      }
      if (novoTotalPago.greaterThan(limiteMaximo)) {
        throw new BadRequestException(
          `Valor pago (${novoTotalPago.toFixed(2)}) excede o saldo devedor com mora (${limiteMaximo.toFixed(2)}).`,
        );
      }

      const novoSaldo     = installmentAmount.minus(novoTotalPago).clampedTo(0, Infinity);
      const parcialmenteQuitado = novoTotalPago.greaterThanOrEqualTo(installmentAmount);

      // Status: pago (quitou o principal), parcialmente_pago, ou mantém atrasado se vencida
      let novoStatus: string;
      if (parcialmenteQuitado) {
        novoStatus = 'pago';
      } else {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const venc = new Date(installment.dataVencimento);
        venc.setHours(0, 0, 0, 0);
        novoStatus = venc < hoje ? 'atrasado' : 'parcialmente_pago';
      }

      // Snapshot "antes"
      const snapshotAntes = {
        status:       installment.status,
        totalPago:    totalPagoAnt.toString(),
        saldoDevedor: installment.saldoDevedor.toString(),
        moraAcumulada: moraAcumulada.toString(),
      };

      // 2. Criar registro de pagamento
      const newPayment = await tx.payment.create({
        data: {
          installmentId:   dto.installmentId,
          valorPago:       valorPago.toDecimalPlaces(2).toNumber(),
          dataPagamento:   new Date(dto.dataPagamento),
          metodoPagamento: (dto.metodoPagamento ?? 'dinheiro') as PaymentMethod,
          observacao:      dto.observacao ?? null,
        },
      });

      // 3. Atualizar totalPago, saldoDevedor e status
      await tx.installment.update({
        where: { id: dto.installmentId },
        data: {
          totalPago:    novoTotalPago.toDecimalPlaces(2).toNumber(),
          saldoDevedor: novoSaldo.toDecimalPlaces(2).toNumber(),
          status:       novoStatus as any,
        },
      });

      // 4. Verificar quitação total do contrato
      if (novoStatus === 'pago') {
        const unpaidCount = await tx.installment.count({
          where: {
            loanId: installment.loanId,
            status: { notIn: ['pago', 'cancelado'] },
            id:     { not: dto.installmentId },
          },
        });
        if (unpaidCount === 0) {
          await tx.loan.update({
            where: { id: installment.loanId },
            data:  { status: 'quitado' },
          });
        }
      }

      // 5. Criar Transaction financeira
      await tx.transaction.create({
        data: {
          tipo:      'entrada',
          valor:     valorPago.toDecimalPlaces(2).toNumber(),
          descricao: `Pgto ${novoStatus === 'pago' ? 'total' : 'parcial'} parcela #${installment.numero} - ${installment.loan.client.nome}`,
          categoria: 'Pagamento de Parcela',
          data:      new Date(dto.dataPagamento),
          userId:    userId ?? null,
        },
      });

      // 6. AuditLog
      const snapshotDepois = {
        status:       novoStatus,
        totalPago:    novoTotalPago.toString(),
        saldoDevedor: novoSaldo.toString(),
        parcial:      novoStatus !== 'pago',
      };

      const dadosAudit = {
        snapshot: {
          antes: snapshotAntes,
          depois: snapshotDepois,
          pagamento: {
            paymentId:       newPayment.id,
            valorPago:       valorPago.toString(),
            metodoPagamento: dto.metodoPagamento ?? 'dinheiro',
            dataPagamento:   dto.dataPagamento,
            parcela_split: {
              principalPayback: installment.principalPayback.toString(),
              netGain:          installment.netGain.toString(),
            },
          },
        },
      };

      const hash = createHash('sha256')
        .update(JSON.stringify({ userId, acao: 'PAYMENT_REGISTRADO', entidade: 'installments', entidadeId: installment.id, dados: dadosAudit, ts: Date.now() }))
        .digest('hex');

      await tx.auditLog.create({
        data: {
          userId:     userId ?? null,
          acao:       'PAYMENT_REGISTRADO',
          entidade:   'installments',
          entidadeId: installment.id,
          dados:      dadosAudit as Prisma.InputJsonValue,
          hash,
        },
      });

      return { payment: newPayment, clientId: installment.loan.client.id };
    });

    void this.scoreRisco.recalcularScore(payment.clientId);
    return payment.payment;
  }

  async findAll(search?: string): Promise<unknown[]> {
    return this.prisma.payment.findMany({
      where: search
        ? {
            installment: {
              loan: {
                client: { nome: { contains: search, mode: 'insensitive' } },
              },
            },
          }
        : undefined,
      include: {
        installment: {
          include: {
            loan: { include: { client: { select: { nome: true } } } },
          },
        },
      },
      orderBy: { dataPagamento: 'desc' },
      take: 100,
    });
  }

  async findByInstallment(installmentId: number): Promise<unknown[]> {
    return this.prisma.payment.findMany({
      where: { installmentId },
      orderBy: { dataPagamento: 'desc' },
    });
  }

  async estornar(id: number, userId?: number): Promise<unknown> {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Buscar pagamento com parcela e loan
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          installment: {
            include: {
              loan: {
                include: { client: { select: { id: true, nome: true } } },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Pagamento com id ${id} não encontrado`);
      }

      const installment = payment.installment;
      const loan        = installment.loan;

      // Snapshot "antes" do estorno
      const snapshotAntes = {
        status:            installment.status,
        totalPago:         installment.totalPago.toString(),
        installmentAmount: installment.installmentAmount.toString(),
        principalPayback:  installment.principalPayback.toString(),
        netGain:           installment.netGain.toString(),
      };

      // 2. Deletar o pagamento
      await tx.payment.delete({ where: { id } });

      // 3. Recalcular totalPago restante
      const remaining = await tx.payment.aggregate({
        where: { installmentId: installment.id },
        _sum:  { valorPago: true },
      });
      const novoTotalPago = Number(remaining._sum.valorPago ?? 0);

      // 4. Determinar novo status da parcela após estorno
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const vencimento = new Date(installment.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const vencido = vencimento < hoje;

      let novoStatus: string;
      if (novoTotalPago <= 0) {
        novoStatus = vencido ? 'atrasado' : 'pendente';
      } else {
        // ainda há pagamento parcial
        novoStatus = vencido ? 'atrasado' : 'parcialmente_pago';
      }

      const installmentAmount = new Decimal(installment.installmentAmount.toString());
      const novoSaldo = installmentAmount.minus(novoTotalPago).clampedTo(0, Infinity);

      await tx.installment.update({
        where: { id: installment.id },
        data:  { totalPago: novoTotalPago, saldoDevedor: novoSaldo.toDecimalPlaces(2).toNumber(), status: novoStatus as any },
      });

      // 5. Se loan estava quitado, voltar para ativo
      if (loan.status === 'quitado') {
        await tx.loan.update({
          where: { id: loan.id },
          data:  { status: 'ativo' },
        });
      }

      // 6. Criar Transaction de estorno
      const clientNome = loan.client.nome;
      await tx.transaction.create({
        data: {
          tipo:      'saida',
          valor:     Number(payment.valorPago),
          descricao: `Estorno pagamento parcela #${installment.numero} - ${clientNome}`,
          categoria: 'Estorno',
          data:      new Date(),
          userId:    userId ?? null,
        },
      });

      // 7. AuditLog — snapshot do estorno com split
      const snapshotDepois = {
        status:    novoStatus,
        totalPago: novoTotalPago.toString(),
      };

      const dadosAudit = {
        snapshot: {
          antes: snapshotAntes,
          depois: snapshotDepois,
          estorno: {
            paymentId:       id,
            valorEstornado:  payment.valorPago.toString(),
            metodoPagamento: payment.metodoPagamento,
            parcela_split: {
              principalPayback: installment.principalPayback.toString(),
              netGain:          installment.netGain.toString(),
            },
          },
        },
      };

      const hash = createHash('sha256')
        .update(JSON.stringify({
          userId,
          acao:       'PAYMENT_ESTORNADO',
          entidade:   'installments',
          entidadeId: installment.id,
          dados:      dadosAudit,
          ts:         Date.now(),
        }))
        .digest('hex');

      await tx.auditLog.create({
        data: {
          userId:     userId ?? null,
          acao:       'PAYMENT_ESTORNADO',
          entidade:   'installments',
          entidadeId: installment.id,
          dados:      dadosAudit as Prisma.InputJsonValue,
          hash,
        },
      });

      return {
        message: 'Pagamento estornado com sucesso',
        paymentId: id,
        clientId: installment.loan.client.id,
      };
    });

    void this.scoreRisco.recalcularScore(result.clientId);
    return { message: result.message, paymentId: result.paymentId };
  }
}
