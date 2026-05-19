import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import Decimal from 'decimal.js';
import { PrismaService } from '../../prisma/prisma.service';
import { GeneratePixDto, ChargeTipo } from './dto/generate-pix.dto';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface MpPaymentResponse {
  id: number;
  status: string;
  status_detail?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  barcode?: { content?: string };
  transaction_details?: { external_resource_url?: string };
}

@Injectable()
export class PixService {
  private readonly logger = new Logger(PixService.name);

  constructor(private readonly prisma: PrismaService) {}

  async generate(dto: GeneratePixDto): Promise<unknown> {
    const tipo = dto.tipo ?? ChargeTipo.PIX;

    const installment = await this.prisma.installment.findUnique({
      where: { id: dto.installmentId },
      include: {
        loan: {
          select: {
            id: true,
            taxaMora: true,
            taxaMulta: true,
            client: {
              select: {
                id: true,
                nome: true,
                email: true,
                cpf: true,
                whatsapp: true,
                endereco: true,
                bairro: true,
                cidade: true,
                estado: true,
                cep: true,
              },
            },
          },
        },
      },
    });

    if (!installment) {
      throw new NotFoundException(`Parcela ${dto.installmentId} não encontrada`);
    }

    if (installment.status === 'pago' || installment.status === 'cancelado') {
      throw new BadRequestException(`Parcela já está ${installment.status}`);
    }

    const saldo = new Decimal(installment.valor.toString()).minus(
      installment.totalPago.toString(),
    );

    if (saldo.lte(0)) {
      throw new BadRequestException('Parcela já está quitada');
    }

    const client = installment.loan.client;

    // Return existing valid (non-expired) pending charge of same tipo
    const existing = await this.prisma.pixPayment.findFirst({
      where: {
        installmentId: dto.installmentId,
        tipo,
        status: 'pendente',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) return existing;

    const mpResponse = await this._callMpApi(tipo, saldo.toNumber(), installment, client, dto);

    const expiresAt = this._computeExpiresAt(tipo, dto);

    return this.prisma.pixPayment.create({
      data: {
        installmentId: dto.installmentId,
        clientId: client.id,
        paymentId: String(mpResponse.id),
        tipo,
        qrCode: mpResponse.point_of_interaction?.transaction_data?.qr_code ?? null,
        qrImage: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
        barcodeContent: mpResponse.barcode?.content ?? null,
        boletoUrl: mpResponse.transaction_details?.external_resource_url ?? null,
        amount: saldo.toDecimalPlaces(2).toNumber(),
        valorEncargos: null,
        expiresAt,
        status: 'pendente',
      },
    });
  }

  async reissue(id: number): Promise<unknown> {
    const charge = await this.prisma.pixPayment.findUnique({
      where: { id },
      include: {
        installment: {
          include: {
            loan: {
              select: {
                id: true,
                taxaMora: true,
                taxaMulta: true,
                client: {
                  select: {
                    id: true,
                    nome: true,
                    email: true,
                    cpf: true,
                    whatsapp: true,
                    endereco: true,
                    bairro: true,
                    cidade: true,
                    estado: true,
                    cep: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!charge) throw new NotFoundException(`Cobrança ${id} não encontrada`);

    // Expire old charge
    await this.prisma.pixPayment.update({
      where: { id },
      data: { status: 'expirado' },
    });

    // Best-effort cancel on MP side
    if (charge.paymentId) {
      try {
        await axios.put(
          `https://api.mercadopago.com/v1/payments/${charge.paymentId}`,
          { status: 'cancelled' },
          { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
        );
      } catch {
        /* PIX/boleto já pode estar expirado no MP — ignorar */
      }
    }

    const installment = charge.installment;
    const loan = installment.loan;
    const client = loan.client;

    const saldo = new Decimal(installment.valor.toString()).minus(
      installment.totalPago.toString(),
    );

    // Calculate mora + multa for overdue installments
    let valorEncargos = new Decimal(0);
    const agora = new Date();
    const vencimento = new Date(installment.dataVencimento);

    if (vencimento < agora) {
      const daysOverdue = Math.max(
        1,
        Math.floor((agora.getTime() - vencimento.getTime()) / 86_400_000),
      );
      const taxaMulta = new Decimal(loan.taxaMulta?.toString() ?? '2'); // %
      const taxaMora = new Decimal(loan.taxaMora?.toString() ?? '1');   // % ao mês

      const multa = saldo.mul(taxaMulta).div(100);
      const mora = saldo.mul(taxaMora).div(100).div(30).mul(daysOverdue);
      valorEncargos = multa.add(mora).toDecimalPlaces(2);
    }

    const valorTotal = saldo.add(valorEncargos).toDecimalPlaces(2);
    const tipo = charge.tipo as ChargeTipo;

    const mpResponse = await this._callMpApi(tipo, valorTotal.toNumber(), installment, client, {});

    const expiresAt = this._computeExpiresAt(tipo, {});

    return this.prisma.pixPayment.create({
      data: {
        installmentId: installment.id,
        clientId: client.id,
        paymentId: String(mpResponse.id),
        tipo,
        qrCode: mpResponse.point_of_interaction?.transaction_data?.qr_code ?? null,
        qrImage: mpResponse.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
        barcodeContent: mpResponse.barcode?.content ?? null,
        boletoUrl: mpResponse.transaction_details?.external_resource_url ?? null,
        amount: saldo.toDecimalPlaces(2).toNumber(),
        valorEncargos: valorEncargos.gt(0) ? valorEncargos.toNumber() : null,
        expiresAt,
        status: 'pendente',
      },
    });
  }

  async findByInstallment(installmentId: number): Promise<unknown[]> {
    return this.prisma.pixPayment.findMany({
      where: { installmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async checkStatus(id: number): Promise<unknown> {
    const pixPayment = await this.prisma.pixPayment.findUnique({ where: { id } });
    if (!pixPayment) throw new NotFoundException(`Cobrança ${id} não encontrada`);

    if (pixPayment.status === 'pago') return pixPayment;
    if (!pixPayment.paymentId) return pixPayment;

    try {
      const { data } = await axios.get<MpPaymentResponse>(
        `https://api.mercadopago.com/v1/payments/${pixPayment.paymentId}`,
        { headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` } },
      );

      if (data.status === 'approved') {
        return this.prisma.pixPayment.update({
          where: { id },
          data: { status: 'pago' },
        });
      }

      if (data.status === 'cancelled' && pixPayment.status === 'pendente') {
        await this.prisma.pixPayment.update({
          where: { id },
          data: { status: 'cancelado' },
        });
      }

      return { ...pixPayment, mpStatus: data.status, mpStatusDetail: data.status_detail };
    } catch {
      return pixPayment;
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _callMpApi(
    tipo: ChargeTipo,
    amount: number,
    installment: { id: number; numero: number },
    client: {
      nome: string;
      email: string | null;
      cpf: string | null;
      endereco: string | null;
      bairro: string | null;
      cidade: string | null;
      estado: string | null;
      cep: string | null;
    },
    opts: { expirationHours?: number; expirationDays?: number },
  ): Promise<MpPaymentResponse> {
    const mpToken = process.env.MP_ACCESS_TOKEN;
    if (!mpToken || !mpToken.startsWith('APP_USR-')) {
      throw new BadRequestException(
        'MP_ACCESS_TOKEN não configurado. Configure em backend/.env e reinicie o serviço.',
      );
    }

    const expiresAt = this._computeExpiresAt(tipo, opts);
    const externalRef = `inst_${installment.id}_${tipo}_${Date.now()}`;
    const notificationUrl = process.env.MP_NOTIFICATION_URL
      ? `${process.env.MP_NOTIFICATION_URL}?source_news=webhooks`
      : undefined;

    const nomeParts = client.nome.trim().split(' ');
    const firstName = nomeParts[0];
    const lastName = nomeParts.slice(1).join(' ') || firstName;
    const email = client.email ?? 'cliente@siafi.app.br';
    const cpfDigits = client.cpf ? client.cpf.replace(/\D/g, '') : null;

    const payer: Record<string, unknown> = {
      email,
      first_name: firstName,
      last_name: lastName,
    };

    if (cpfDigits && cpfDigits.length === 11) {
      payer.identification = { type: 'CPF', number: cpfDigits };
    }

    if (tipo === ChargeTipo.BOLETO && client.cep) {
      payer.address = {
        zip_code: client.cep.replace(/\D/g, ''),
        street_name: client.endereco ?? 'Endereço não informado',
        street_number: '0',
        neighborhood: client.bairro ?? 'Não informado',
        city: client.cidade ?? 'Não informado',
        federal_unit: client.estado ?? 'SP',
      };
    }

    const payload: Record<string, unknown> = {
      transaction_amount: amount,
      description: `Parcela #${installment.numero} — ${client.nome}`,
      payment_method_id: tipo === ChargeTipo.PIX ? 'pix' : 'bolbradesco',
      external_reference: externalRef,
      date_of_expiration: expiresAt.toISOString(),
      payer,
    };

    if (notificationUrl) payload.notification_url = notificationUrl;

    try {
      const { data } = await axios.post<MpPaymentResponse>(
        'https://api.mercadopago.com/v1/payments',
        payload,
        {
          headers: {
            Authorization: `Bearer ${mpToken}`,
            'Content-Type': 'application/json',
            'X-Idempotency-Key': externalRef,
          },
        },
      );
      return data;
    } catch (err: any) {
      const detail = err.response?.data;
      this.logger.error(
        `MP ${tipo} generation failed`,
        JSON.stringify(detail ?? err.message),
      );
      throw new BadRequestException(
        `Falha ao gerar ${tipo === ChargeTipo.PIX ? 'PIX' : 'boleto'} no Mercado Pago: ${
          detail?.message ?? err.message
        }`,
      );
    }
  }

  private _computeExpiresAt(
    tipo: ChargeTipo,
    opts: { expirationHours?: number; expirationDays?: number },
  ): Date {
    if (tipo === ChargeTipo.PIX) {
      const hours = opts.expirationHours ?? 24;
      return new Date(Date.now() + hours * 3_600_000);
    } else {
      const days = opts.expirationDays ?? 3;
      return new Date(Date.now() + days * 86_400_000);
    }
  }
}
