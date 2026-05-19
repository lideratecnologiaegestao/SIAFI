import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratePixDto } from './dto/generate-pix.dto';

interface MpPixResponse {
  id: number;
  status: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
}

@Injectable()
export class PixService {
  private readonly logger = new Logger(PixService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generate(dto: GeneratePixDto): Promise<unknown> {
    const installment = await this.prisma.installment.findUnique({
      where: { id: dto.installmentId },
      include: {
        loan: {
          include: {
            client: { select: { id: true, nome: true, email: true, cpf: true } },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundException(`Parcela ${dto.installmentId} não encontrada`);
    }

    if (
      installment.status === 'pago' ||
      installment.status === 'cancelado'
    ) {
      throw new BadRequestException(`Parcela já está ${installment.status}`);
    }

    const saldoRestante = Number(installment.valor) - Number(installment.totalPago);
    if (saldoRestante <= 0) {
      throw new BadRequestException('Parcela já está quitada');
    }

    const client = installment.loan.client;

    const existing = await this.prisma.pixPayment.findFirst({
      where: { installmentId: dto.installmentId, status: 'pendente' },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return existing;
    }

    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken || mpToken.startsWith('APP_USR-') === false) {
      throw new BadRequestException('MP_ACCESS_TOKEN não configurado');
    }

    let mpResponse: MpPixResponse;
    try {
      const { data } = await axios.post<MpPixResponse>(
        'https://api.mercadopago.com/v1/payments',
        {
          transaction_amount: saldoRestante,
          description: `Parcela #${installment.numero} - ${client.nome}`,
          payment_method_id: 'pix',
          payer: {
            email: client.email ?? 'cliente@siafi.app',
            first_name: client.nome.split(' ')[0],
            last_name:
              client.nome.split(' ').slice(1).join(' ') ||
              client.nome.split(' ')[0],
            identification: client.cpf
              ? { type: 'CPF', number: client.cpf.replace(/\D/g, '') }
              : undefined,
          },
          external_reference: `installment_${installment.id}`,
        },
        {
          headers: {
            Authorization: `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': `pix_inst_${installment.id}_${Date.now()}`,
          },
        },
      );
      mpResponse = data;
    } catch (err) {
      this.logger.error('MP PIX generation failed', err);
      throw new BadRequestException('Falha ao gerar QR Code PIX no Mercado Pago');
    }

    const qrCode =
      mpResponse.point_of_interaction?.transaction_data?.qr_code ?? null;
    const qrImage =
      mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 ?? null;

    const pixPayment = await this.prisma.pixPayment.create({
      data: {
        installmentId: dto.installmentId,
        clientId: client.id,
        paymentId: String(mpResponse.id),
        qrCode,
        qrImage,
        amount: saldoRestante,
        status: 'pendente',
      },
    });

    return pixPayment;
  }

  async findByInstallment(installmentId: number): Promise<unknown[]> {
    return this.prisma.pixPayment.findMany({
      where: { installmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkStatus(id: number): Promise<unknown> {
    const pixPayment = await this.prisma.pixPayment.findUnique({ where: { id } });
    if (!pixPayment) throw new NotFoundException(`PixPayment ${id} não encontrado`);

    if (pixPayment.status === 'pago') return pixPayment;

    if (!pixPayment.paymentId) return pixPayment;

    try {
      const { data } = await axios.get<MpPixResponse>(
        `https://api.mercadopago.com/v1/payments/${pixPayment.paymentId}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
      );

      if (data.status === 'approved' && pixPayment.status !== 'pago') {
        await this.prisma.pixPayment.update({
          where: { id },
          data: { status: 'pago' },
        });
        return { ...pixPayment, status: 'pago', mpStatus: data.status };
      }

      return { ...pixPayment, mpStatus: data.status };
    } catch {
      return pixPayment;
    }
  }
}
