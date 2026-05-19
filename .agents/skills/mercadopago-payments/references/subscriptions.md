# Assinaturas Recorrentes (Subscriptions)

API MP: `/preapproval_plan` (plano) + `/preapproval` (assinatura do cliente)

## Fluxo

```
1. Criar Plano        POST /preapproval_plan       → preapproval_plan_id
2. Assinar            POST /preapproval             → preapproval_id + init_point
3. Cliente paga       Redireciona para init_point
4. MP cobra           Automaticamente na frequência configurada
5. Notificação        Webhook topic: "subscription_preapproval"
6. Gerenciar          pause / cancel / update       PUT /preapproval/{id}
```

---

## `subscriptions.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { MercadoPagoConfig, PreApprovalPlan, PreApproval } from 'mercadopago';
import { MP_CLIENT } from './payments.module';
import { v4 as uuid } from 'uuid';

export interface CreatePlanDto {
  reason: string;             // nome do plano (ex: "Plano Mensal Premium")
  amount: number;             // valor em BRL
  frequencyType: 'days' | 'months';
  frequency: number;          // ex: 1 (mensal), 7 (semanal em dias)
  repetitions?: number;       // nulo = sem fim
  billingDay?: number;        // 1-28, dia fixo de cobrança
  freeTrial?: {
    frequency: number;
    frequencyType: 'days' | 'months';
  };
  backUrl: string;
}

export interface CreateSubscriptionDto {
  planId: string;             // preapproval_plan_id
  payerEmail: string;
  cardTokenId?: string;       // token do cartão (Checkout Bricks)
  externalReference: string;  // seu ID interno do cliente/assinatura
  startDate?: string;         // ISO 8601; padrão: agora
  endDate?: string;           // ISO 8601; nulo = sem fim
  backUrl: string;
}

@Injectable()
export class SubscriptionsService {
  private planClient: PreApprovalPlan;
  private subscriptionClient: PreApproval;

  constructor(@Inject(MP_CLIENT) private mpConfig: MercadoPagoConfig) {
    this.planClient = new PreApprovalPlan(mpConfig);
    this.subscriptionClient = new PreApproval(mpConfig);
  }

  // ── Planos ────────────────────────────────────────────────────────────────

  async createPlan(dto: CreatePlanDto) {
    return this.planClient.create({
      body: {
        reason: dto.reason,
        auto_recurring: {
          frequency: dto.frequency,
          frequency_type: dto.frequencyType,
          repetitions: dto.repetitions,
          billing_day: dto.billingDay,
          billing_day_proportional: !!dto.billingDay,
          free_trial: dto.freeTrial
            ? {
                frequency: dto.freeTrial.frequency,
                frequency_type: dto.freeTrial.frequencyType,
              }
            : undefined,
          transaction_amount: dto.amount,
          currency_id: 'BRL',
        },
        payment_methods_allowed: {
          payment_types: [{ id: 'credit_card' }],
        },
        back_url: dto.backUrl,
      },
    });
  }

  async getPlan(planId: string) {
    return this.planClient.get({ preApprovalPlanId: planId });
  }

  async updatePlan(planId: string, updates: Partial<CreatePlanDto>) {
    return this.planClient.update({
      preApprovalPlanId: planId,
      body: {
        reason: updates.reason,
        auto_recurring: updates.amount
          ? { transaction_amount: updates.amount, currency_id: 'BRL' }
          : undefined,
      },
    });
  }

  // ── Assinaturas ───────────────────────────────────────────────────────────

  async createSubscription(dto: CreateSubscriptionDto) {
    const body: any = {
      preapproval_plan_id: dto.planId,
      reason: 'Assinatura',
      external_reference: dto.externalReference,
      payer_email: dto.payerEmail,
      back_url: dto.backUrl,
      auto_recurring: {
        start_date: dto.startDate ?? new Date().toISOString(),
        end_date: dto.endDate,
        currency_id: 'BRL',
      },
      status: 'pending', // pending = aguarda autorização do pagador
    };

    // Se cartão já tokenizado (checkout headless)
    if (dto.cardTokenId) {
      body.card_token_id = dto.cardTokenId;
      body.status = 'authorized'; // cobrança imediata
    }

    const response = await this.subscriptionClient.create({ body });

    return {
      subscriptionId: response.id,
      status: response.status,
      // init_point = URL para o pagador autorizar via MP Checkout
      checkoutUrl: response.init_point,
    };
  }

  async getSubscription(subscriptionId: string) {
    return this.subscriptionClient.get({ preApprovalId: subscriptionId });
  }

  async pauseSubscription(subscriptionId: string) {
    return this.subscriptionClient.update({
      preApprovalId: subscriptionId,
      body: { status: 'paused' },
    });
  }

  async resumeSubscription(subscriptionId: string) {
    return this.subscriptionClient.update({
      preApprovalId: subscriptionId,
      body: { status: 'authorized' },
    });
  }

  async cancelSubscription(subscriptionId: string) {
    return this.subscriptionClient.update({
      preApprovalId: subscriptionId,
      body: { status: 'cancelled' },
    });
  }

  /** Lista assinaturas de um pagador */
  async listByPayer(payerEmail: string) {
    return this.subscriptionClient.search({
      options: { payer_email: payerEmail },
    });
  }
}
```

---

## Rotas no Controller

```typescript
// POST /payments/subscriptions/plans
@Post('subscriptions/plans')
createPlan(@Body() dto: CreatePlanDto) {
  return this.subscriptionsService.createPlan(dto);
}

// POST /payments/subscriptions
@Post('subscriptions')
createSubscription(@Body() dto: CreateSubscriptionDto) {
  return this.subscriptionsService.createSubscription(dto);
}

// GET /payments/subscriptions/:id
@Get('subscriptions/:id')
getSubscription(@Param('id') id: string) {
  return this.subscriptionsService.getSubscription(id);
}

// PATCH /payments/subscriptions/:id/pause
@Patch('subscriptions/:id/pause')
pauseSubscription(@Param('id') id: string) {
  return this.subscriptionsService.pauseSubscription(id);
}

// PATCH /payments/subscriptions/:id/cancel
@Patch('subscriptions/:id/cancel')
cancelSubscription(@Param('id') id: string) {
  return this.subscriptionsService.cancelSubscription(id);
}
```

---

## Webhook — Evento de Cobrança Recorrente

Quando o MP cobra automaticamente, ele envia:

```json
{
  "action": "payment.created",
  "type": "payment",
  "data": { "id": "123456789" }
}
```

E também:

```json
{
  "action": "updated",
  "type": "subscription_preapproval",
  "data": { "id": "preapproval_id_aqui" }
}
```

No seu webhook handler (veja `references/webhook.md`), ao receber `subscription_preapproval`:

```typescript
case 'subscription_preapproval': {
  const sub = await this.subscriptionsService.getSubscription(event.data.id);
  await this.prisma.subscription.update({
    where: { mpSubscriptionId: event.data.id },
    data: { status: sub.status },
  });
  break;
}
```

---

## Schema Prisma — Subscription + Plan

```prisma
model SubscriptionPlan {
  id          String   @id @default(cuid())
  mpPlanId    String   @unique
  name        String
  amount      Decimal
  frequency   Int
  frequencyType String
  status      String
  subscriptions Subscription[]
  createdAt   DateTime @default(now())
}

model Subscription {
  id               String   @id @default(cuid())
  mpSubscriptionId String   @unique
  status           String   // authorized | paused | cancelled | pending
  payerEmail       String
  externalReference String
  planId           String
  plan             SubscriptionPlan @relation(fields: [planId], references: [id])
  customerId       String
  customer         Customer @relation(fields: [customerId], references: [id])
  startDate        DateTime?
  endDate          DateTime?
  nextPaymentDate  DateTime?
  payments         Payment[]
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

## Teste em Sandbox

1. Crie dois usuários de teste: vendedor e comprador
2. Use o `access_token` do vendedor no backend
3. Use o email do comprador em `payer_email`
4. Para cartão, use os dados de cartão de teste da documentação do MP:
   - Mastercard aprovado: `5031 4332 1540 6351` / CVV `123` / Venc `11/25` / Nome `APRO`
5. Acesse o `init_point` retornado e complete o checkout no browser com o usuário comprador
