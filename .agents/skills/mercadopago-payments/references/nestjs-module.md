# NestJS Module — Estrutura Completa, DI e Guards

## `payments.controller.ts` — Rotas Principais

```typescript
import {
  Controller, Post, Get, Patch, Param, Body,
  Query, UseGuards, Req, HttpCode,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PixService } from './pix.service';
import { BoletoService } from './boleto.service';
import { SubscriptionsService } from './subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard) // protege todas as rotas (exceto webhook)
export class PaymentsController {
  constructor(
    private paymentsService: PaymentsService,
    private pixService: PixService,
    private boletoService: BoletoService,
    private subscriptionsService: SubscriptionsService,
    private prisma: PrismaService,
  ) {}

  // ── PIX ──────────────────────────────────────────────────────────────────

  @Post('pix')
  @HttpCode(201)
  async createPix(@Body() dto: any) {
    return this.pixService.createPixPayment(dto);
  }

  @Get('pix/:id/status')
  async pixStatus(@Param('id') id: string) {
    return this.pixService.getPixStatus(Number(id));
  }

  // ── Boleto ────────────────────────────────────────────────────────────────

  @Post('boleto')
  @HttpCode(201)
  async createBoleto(@Body() dto: any) {
    return this.boletoService.createBoleto(dto);
  }

  @Get('boleto/due-soon')
  async getDueSoon(@Query('days') days = '3') {
    return this.boletoService.getDueSoon(Number(days), this.prisma);
  }

  @Get('boleto/overdue')
  async getOverdue() {
    return this.boletoService.getOverdue(this.prisma);
  }

  @Post('boleto/:id/manual-writeoff')
  @UseGuards(AdminGuard)
  async manualWriteOff(@Param('id') id: string, @Req() req: any) {
    return this.boletoService.manualWriteOff(Number(id), req.user.id, this.prisma);
  }

  @Post('boleto/:id/cancel')
  @UseGuards(AdminGuard)
  async cancelBoleto(@Param('id') id: string) {
    return this.boletoService.cancelBoleto(Number(id));
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────

  @Post('subscriptions/plans')
  createPlan(@Body() dto: any) {
    return this.subscriptionsService.createPlan(dto);
  }

  @Post('subscriptions')
  createSubscription(@Body() dto: any) {
    return this.subscriptionsService.createSubscription(dto);
  }

  @Get('subscriptions/:id')
  getSubscription(@Param('id') id: string) {
    return this.subscriptionsService.getSubscription(id);
  }

  @Patch('subscriptions/:id/pause')
  pauseSubscription(@Param('id') id: string) {
    return this.subscriptionsService.pauseSubscription(id);
  }

  @Patch('subscriptions/:id/resume')
  resumeSubscription(@Param('id') id: string) {
    return this.subscriptionsService.resumeSubscription(id);
  }

  @Patch('subscriptions/:id/cancel')
  cancelSubscription(@Param('id') id: string) {
    return this.subscriptionsService.cancelSubscription(id);
  }

  // ── Listagem Geral ────────────────────────────────────────────────────────

  @Get()
  listPayments(
    @Query('status') status?: string,
    @Query('method') method?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.paymentsService.list({ status, method, page: Number(page), limit: Number(limit) });
  }

  @Get(':id')
  getPayment(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }
}
```

---

## `payments.service.ts` — Serviço Base

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { MP_CLIENT } from './payments.module';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private paymentClient: Payment;

  constructor(
    @Inject(MP_CLIENT) private mpConfig: MercadoPagoConfig,
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {
    this.paymentClient = new Payment(mpConfig);
  }

  async processPaymentEvent(paymentId: string) {
    // Verifica idempotência
    const alreadyProcessed = await this.prisma.webhookLog.findFirst({
      where: { mpPaymentId: paymentId, processed: true },
    });
    if (alreadyProcessed) return;

    const mpPayment = await this.paymentClient.get({ id: Number(paymentId) });

    const payment = await this.prisma.payment.upsert({
      where: { mpPaymentId: Number(paymentId) },
      update: {
        status: mpPayment.status!,
        paidAt: mpPayment.date_approved
          ? new Date(mpPayment.date_approved)
          : undefined,
      },
      create: {
        mpPaymentId: Number(paymentId),
        status: mpPayment.status!,
        amount: mpPayment.transaction_amount!,
        paymentMethod: mpPayment.payment_method_id!,
        externalReference: mpPayment.external_reference ?? '',
        paidAt: mpPayment.date_approved
          ? new Date(mpPayment.date_approved)
          : undefined,
        // customerId deve ser derivado do externalReference no seu sistema
        customerId: 'unknown',
      },
    });

    await this.prisma.webhookLog.create({
      data: { mpPaymentId: paymentId, processed: true, processedAt: new Date() },
    });

    if (mpPayment.status === 'approved') {
      this.eventEmitter.emit('payment.approved', payment);
    }

    return payment;
  }

  async list(filters: { status?: string; method?: string; page: number; limit: number }) {
    const skip = (filters.page - 1) * filters.limit;
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.method) where.paymentMethod = filters.method;

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({ where, skip, take: filters.limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page: filters.page, pages: Math.ceil(total / filters.limit) };
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Pagamento não encontrado');
    return payment;
  }
}
```

---

## `app.module.ts` — Registrar Módulo

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),
    PrismaModule,
    PaymentsModule,
  ],
})
export class AppModule {}
```

---

## Variáveis de Ambiente Completas

```env
# Mercado Pago
MP_ACCESS_TOKEN=APP_USR-xxxx
MP_PUBLIC_KEY=APP_USR-xxxx
MP_WEBHOOK_SECRET=xxxx
MP_NOTIFICATION_URL=https://api.seusite.com/payments/webhook

# Redis (para filas Bull)
REDIS_HOST=localhost
REDIS_PORT=6379

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/payments_db
```

---

## Prisma Schema Completo

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Customer {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String
  cpf           String?        @unique
  payments      Payment[]
  subscriptions Subscription[]
  createdAt     DateTime       @default(now())
}

model Payment {
  id               String    @id @default(cuid())
  mpPaymentId      Int       @unique
  paymentMethod    String
  status           String
  amount           Decimal
  externalReference String
  barcodeContent   String?
  boletoUrl        String?
  qrCodeBase64     String?
  qrCode           String?
  expiresAt        DateTime?
  paidAt           DateTime?
  manualWriteOff   Boolean   @default(false)
  manualWriteOffBy String?
  manualWriteOffAt DateTime?
  customerId       String
  customer         Customer  @relation(fields: [customerId], references: [id])
  subscriptionId   String?
  subscription     Subscription? @relation(fields: [subscriptionId], references: [id])
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model SubscriptionPlan {
  id             String         @id @default(cuid())
  mpPlanId       String         @unique
  name           String
  amount         Decimal
  frequency      Int
  frequencyType  String
  status         String
  subscriptions  Subscription[]
  createdAt      DateTime       @default(now())
}

model Subscription {
  id               String           @id @default(cuid())
  mpSubscriptionId String           @unique
  status           String
  payerEmail       String
  externalReference String
  planId           String
  plan             SubscriptionPlan @relation(fields: [planId], references: [id])
  customerId       String
  customer         Customer         @relation(fields: [customerId], references: [id])
  payments         Payment[]
  startDate        DateTime?
  endDate          DateTime?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}

model WebhookLog {
  id           String   @id @default(cuid())
  mpPaymentId  String
  processed    Boolean  @default(false)
  processedAt  DateTime?
  error        String?
  createdAt    DateTime @default(now())
  @@index([mpPaymentId])
}
```
