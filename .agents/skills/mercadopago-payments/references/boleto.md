# Boleto Bancário — Emissão, Alertas, Baixa Automática e Manual

## Endpoint da API MP
`POST https://api.mercadopago.com/v1/payments`
`payment_method_id: "bolbradesco"` (Bradesco) | `"pec"` (ItaúShop/Loterica) | `"bancodobrasil"`

---

## `boleto.service.ts`

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MP_CLIENT } from './payments.module';
import { v4 as uuid } from 'uuid';

export interface CreateBoletoDto {
  amount: number;
  description: string;
  externalReference: string;
  daysToExpire?: number;         // padrão: 3 (mínimo recomendado pelo MP)
  payerEmail: string;
  payerFirstName: string;
  payerLastName: string;
  payerCpf: string;
  payerZipCode: string;
  payerStreetName: string;
  payerStreetNumber: string;
  payerNeighborhood: string;
  payerCity: string;
  payerState: string;            // UF (ex: "SP")
  paymentMethodId?: string;      // default: "bolbradesco"
}

export interface BoletoResult {
  paymentId: number;
  status: string;
  barcodeContent: string;        // linha digitável
  externalResourceUrl: string;   // PDF do boleto
  expiresAt: string;
}

@Injectable()
export class BoletoService {
  private paymentClient: Payment;

  constructor(@Inject(MP_CLIENT) private mpConfig: MercadoPagoConfig) {
    this.paymentClient = new Payment(mpConfig);
  }

  async createBoleto(dto: CreateBoletoDto): Promise<BoletoResult> {
    const daysToExpire = dto.daysToExpire ?? 3;
    const expiresAt = new Date(
      Date.now() + daysToExpire * 24 * 60 * 60 * 1000,
    ).toISOString();

    const response = await this.paymentClient.create({
      body: {
        transaction_amount: dto.amount,
        description: dto.description,
        payment_method_id: dto.paymentMethodId ?? 'bolbradesco',
        external_reference: dto.externalReference,
        date_of_expiration: expiresAt,
        notification_url: `${process.env.MP_NOTIFICATION_URL}?source_news=webhooks`,
        payer: {
          email: dto.payerEmail,
          first_name: dto.payerFirstName,
          last_name: dto.payerLastName,
          identification: { type: 'CPF', number: dto.payerCpf },
          address: {
            zip_code: dto.payerZipCode,
            street_name: dto.payerStreetName,
            street_number: dto.payerStreetNumber,
            neighborhood: dto.payerNeighborhood,
            city: dto.payerCity,
            federal_unit: dto.payerState,
          },
        },
      },
      requestOptions: { idempotencyKey: uuid() },
    });

    return {
      paymentId: response.id!,
      status: response.status!,
      barcodeContent: response.barcode?.content ?? '',
      externalResourceUrl: response.transaction_details?.external_resource_url ?? '',
      expiresAt,
    };
  }

  /** Consulta status real no MP (use sempre no webhook, não confie só na notificação) */
  async getBoletoStatus(paymentId: number) {
    const payment = await this.paymentClient.get({ id: paymentId });
    return {
      status: payment.status,
      statusDetail: payment.status_detail,
      paidAt: payment.date_approved,
      expiresAt: payment.date_of_expiration,
    };
  }

  /** Baixa manual — marca como aprovado no banco local */
  async manualWriteOff(paymentId: number, userId: string, prisma: any) {
    // O MP não permite alterar boleto para "approved" via API.
    // A baixa manual é apenas no SEU banco de dados.
    return prisma.payment.update({
      where: { mpPaymentId: paymentId },
      data: {
        status: 'approved',
        manualWriteOff: true,
        manualWriteOffBy: userId,
        manualWriteOffAt: new Date(),
      },
    });
  }

  /** Cancela boleto pendente no MP */
  async cancelBoleto(paymentId: number) {
    return this.paymentClient.cancel({ id: paymentId });
  }

  /** Lista boletos por status no banco local */
  async listByStatus(status: string, prisma: any) {
    return prisma.payment.findMany({
      where: { paymentMethod: 'boleto', status },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /** Boletos a vencer nos próximos N dias */
  async getDueSoon(daysAhead: number, prisma: any) {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 86400_000);
    return prisma.payment.findMany({
      where: {
        paymentMethod: 'boleto',
        status: 'pending',
        expiresAt: { gte: now, lte: future },
      },
      include: { customer: true },
    });
  }

  /** Boletos vencidos (ainda pending no banco, MP já cancelou) */
  async getOverdue(prisma: any) {
    return prisma.payment.findMany({
      where: {
        paymentMethod: 'boleto',
        status: 'pending',
        expiresAt: { lt: new Date() },
      },
      include: { customer: true },
    });
  }
}
```

---

## Alertas com Bull Queue

### `alerts.scheduler.ts` — Cron diário

```typescript
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BoletoService } from '../boleto.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertsScheduler {
  constructor(
    @InjectQueue('payment-alerts') private alertsQueue: Queue,
    private boletoService: BoletoService,
    private prisma: PrismaService,
  ) {}

  /** Roda todo dia às 8h */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scheduleBoletoAlerts() {
    // Boletos a vencer em 3 dias
    const dueSoon = await this.boletoService.getDueSoon(3, this.prisma);
    for (const payment of dueSoon) {
      await this.alertsQueue.add('boleto-due-soon', {
        paymentId: payment.id,
        customerId: payment.customer.id,
        customerEmail: payment.customer.email,
        amount: payment.amount,
        expiresAt: payment.expiresAt,
        barcodeContent: payment.barcodeContent,
      }, { attempts: 3, backoff: 5000 });
    }

    // Boletos vencidos
    const overdue = await this.boletoService.getOverdue(this.prisma);
    for (const payment of overdue) {
      await this.alertsQueue.add('boleto-overdue', {
        paymentId: payment.id,
        customerId: payment.customer.id,
        customerEmail: payment.customer.email,
        amount: payment.amount,
        expiredAt: payment.expiresAt,
      }, { attempts: 3, backoff: 5000 });
    }
  }
}
```

### `alerts.processor.ts` — Worker Bull

```typescript
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { MailService } from '../../mail/mail.service';

@Processor('payment-alerts')
export class AlertsProcessor {
  constructor(private mailService: MailService) {}

  @Process('boleto-due-soon')
  async handleDueSoon(job: Job) {
    const { customerEmail, amount, expiresAt, barcodeContent } = job.data;

    await this.mailService.sendBoletoReminder({
      to: customerEmail,
      subject: '⚠️ Seu boleto vence em breve',
      amount,
      expiresAt,
      barcodeContent,
    });
  }

  @Process('boleto-overdue')
  async handleOverdue(job: Job) {
    const { customerEmail, amount, expiredAt } = job.data;

    await this.mailService.sendBoletoOverdue({
      to: customerEmail,
      subject: '❌ Boleto vencido — regularize sua situação',
      amount,
      expiredAt,
    });
  }
}
```

---

## Rotas no Controller

```typescript
// POST /payments/boleto
@Post('boleto')
async createBoleto(@Body() dto: CreateBoletoDto) {
  const result = await this.boletoService.createBoleto(dto);
  await this.prisma.payment.create({
    data: {
      mpPaymentId: result.paymentId,
      paymentMethod: 'boleto',
      status: result.status,
      amount: dto.amount,
      externalReference: dto.externalReference,
      barcodeContent: result.barcodeContent,
      boletoUrl: result.externalResourceUrl,
      expiresAt: new Date(result.expiresAt),
    },
  });
  return result;
}

// GET /payments/boleto/due-soon?days=3
@Get('boleto/due-soon')
async getDueSoon(@Query('days') days = '3') {
  return this.boletoService.getDueSoon(Number(days), this.prisma);
}

// GET /payments/boleto/overdue
@Get('boleto/overdue')
async getOverdue() {
  return this.boletoService.getOverdue(this.prisma);
}

// POST /payments/boleto/:id/manual-writeoff
@Post('boleto/:id/manual-writeoff')
@UseGuards(AdminGuard)
async manualWriteOff(@Param('id') id: string, @Req() req: Request) {
  return this.boletoService.manualWriteOff(Number(id), req['user'].id, this.prisma);
}
```

---

## Schema Prisma — Payment

```prisma
model Payment {
  id               String   @id @default(cuid())
  mpPaymentId      Int      @unique
  paymentMethod    String   // "boleto" | "pix" | "credit_card"
  status           String   // PaymentStatus enum
  amount           Decimal
  externalReference String
  barcodeContent   String?
  boletoUrl        String?
  qrCodeBase64     String?
  qrCode           String?  // Copia e Cola
  expiresAt        DateTime?
  paidAt           DateTime?
  manualWriteOff   Boolean  @default(false)
  manualWriteOffBy String?
  manualWriteOffAt DateTime?
  customerId       String
  customer         Customer @relation(fields: [customerId], references: [id])
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

## Observações Críticas sobre Boleto

- **Mínimo 3 dias** de prazo para aprovação bancária.
- Após 30 dias sem pagamento, o MP cancela automaticamente.
- O boleto **não pode ser reaprovado** — se vencer, é preciso emitir um novo.
- A baixa automática via webhook é a forma correta. A baixa manual (`manualWriteOff`) é só para casos excepcionais (ex.: boleto pago mas sem retorno do banco).
- Para reemissão de boleto vencido: cancele o antigo (se ainda dentro do prazo) e crie um novo com novo `externalReference`.
