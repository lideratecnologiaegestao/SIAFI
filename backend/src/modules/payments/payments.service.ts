import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto, userId?: number): Promise<unknown> {
    const payment = await this.prisma.$transaction(async (tx) => {
      // 1. Find installment with loan and client
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
        throw new NotFoundException(
          `Parcela com id ${dto.installmentId} não encontrada`,
        );
      }

      // 2. Create Payment record
      const newPayment = await tx.payment.create({
        data: {
          installmentId: dto.installmentId,
          valorPago: dto.valorPago,
          dataPagamento: new Date(dto.dataPagamento),
          metodoPagamento: (dto.metodoPagamento ?? 'dinheiro') as PaymentMethod,
          observacao: dto.observacao ?? null,
        },
      });

      // 3. Update installment totalPago
      const novoTotalPago = Number(installment.totalPago) + dto.valorPago;
      const novoStatus =
        novoTotalPago >= Number(installment.valor) ? 'pago' : installment.status;

      await tx.installment.update({
        where: { id: dto.installmentId },
        data: {
          totalPago: novoTotalPago,
          status: novoStatus,
        },
      });

      // 5. Check if all loan installments are paid
      if (novoStatus === 'pago') {
        const unpaidCount = await tx.installment.count({
          where: {
            loanId: installment.loanId,
            status: { not: 'pago' },
            id: { not: dto.installmentId },
          },
        });

        if (unpaidCount === 0) {
          await tx.loan.update({
            where: { id: installment.loanId },
            data: { status: 'quitado' },
          });
        }
      }

      // 6. Create Transaction
      const clientNome = installment.loan.client.nome;
      await tx.transaction.create({
        data: {
          tipo: 'entrada',
          valor: dto.valorPago,
          descricao: `Pgto parcela #${installment.numero} - ${clientNome}`,
          categoria: 'Pagamento de Parcela',
          data: new Date(dto.dataPagamento),
          userId: userId ?? null,
        },
      });

      return newPayment;
    });

    return payment;
  }

  async findByInstallment(installmentId: number): Promise<unknown[]> {
    return this.prisma.payment.findMany({
      where: { installmentId },
      orderBy: { dataPagamento: 'desc' },
    });
  }

  async estornar(id: number, userId?: number): Promise<unknown> {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Find payment with installment
      const payment = await tx.payment.findUnique({
        where: { id },
        include: {
          installment: {
            include: {
              loan: {
                include: {
                  client: { select: { nome: true } },
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Pagamento com id ${id} não encontrado`);
      }

      const installment = payment.installment;
      const loan = installment.loan;

      // 2. Delete payment
      await tx.payment.delete({ where: { id } });

      // 3. Recalculate installment totalPago
      const remainingPayments = await tx.payment.aggregate({
        where: { installmentId: installment.id },
        _sum: { valorPago: true },
      });
      const novoTotalPago = Number(remainingPayments._sum.valorPago ?? 0);

      // 4. Determine new installment status
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const vencimento = new Date(installment.dataVencimento);
      vencimento.setHours(0, 0, 0, 0);
      const novoStatus = vencimento < today ? 'atrasado' : 'pendente';

      await tx.installment.update({
        where: { id: installment.id },
        data: {
          totalPago: novoTotalPago,
          status: novoStatus,
        },
      });

      // 5. If loan was 'quitado', set back to 'ativo'
      if (loan.status === 'quitado') {
        await tx.loan.update({
          where: { id: loan.id },
          data: { status: 'ativo' },
        });
      }

      // 6. Create estorno Transaction
      const clientNome = loan.client.nome;
      await tx.transaction.create({
        data: {
          tipo: 'saida',
          valor: Number(payment.valorPago),
          descricao: `Estorno pagamento parcela #${installment.numero} - ${clientNome}`,
          categoria: 'Estorno',
          data: new Date(),
          userId: userId ?? null,
        },
      });

      return { message: 'Pagamento estornado com sucesso', paymentId: id };
    });

    return result;
  }
}
