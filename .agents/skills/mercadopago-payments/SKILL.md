---
name: mercadopago-payments
description: >
  Use this skill whenever the user needs to integrate Mercado Pago into a Node.js,
  NestJS, or Next.js project. Covers all payment flows: pagamentos recorrentes
  (assinaturas/subscriptions via preapproval_plan + preapproval), PIX QR Code,
  PIX Copia e Cola, boleto bancário, baixa automática via webhook, baixa manual,
  alertas de boletos vencidos e a vencer, gestão de inadimplência, e cancelamento
  de assinaturas. Also triggers for: "integrar Mercado Pago", "pagamento recorrente
  NestJS", "PIX QR Code backend", "boleto automático", "webhook mercado pago",
  "subscription mercado pago node", "baixa de boleto", "cobrança recorrente",
  "NestJS payment gateway", "checkout transparente node", "notificação pagamento".
  Use this skill even when the user only asks about one payment method — they will
  almost certainly need the full module structure eventually.
---

# Mercado Pago — Integração Completa Node.js / NestJS / Next.js

Stack: **NestJS** (backend API), **Next.js** (frontend), **SDK oficial `mercadopago`**,
**Prisma** (ORM — substituível por TypeORM/Mongoose), **Bull/BullMQ** (filas para alertas).

---

## Índice de Referências

Leia os arquivos de referência conforme o tópico:

| Tópico | Arquivo |
|--------|---------|
| Módulo NestJS completo (structure, DI, guards) | `references/nestjs-module.md` |
| PIX QR Code + Copia e Cola | `references/pix.md` |
| Boleto — emissão, vencimento, alertas, baixa | `references/boleto.md` |
| Assinaturas recorrentes (preapproval) | `references/subscriptions.md` |
| Webhook + validação de assinatura | `references/webhook.md` |
| Frontend Next.js (Bricks + renderização) | `references/nextjs-frontend.md` |
| Ambientes, credenciais, testes | `references/config-credentials.md` |
| Script gerador de estrutura NestJS | `scripts/scaffold.ts` |

---

## Stack & Dependências

```bash
# Backend (NestJS)
npm install mercadopago @nestjs/bull bull ioredis
npm install -D @types/bull

# Frontend (Next.js)
npm install @mercadopago/sdk-js
```

SDK oficial: `mercadopago` (npm) — usa a **API v2** com `MercadoPagoConfig`.

---

## Credenciais Necessárias

```env
# .env
MP_ACCESS_TOKEN=APP_USR-xxxx       # Chave privada (server-side ONLY)
MP_PUBLIC_KEY=APP_USR-xxxx         # Chave pública (client-side)
MP_WEBHOOK_SECRET=xxxx             # Segredo do webhook (Suas integrações)
MP_NOTIFICATION_URL=https://api.seusite.com/payments/webhook
```

⚠️ O `ACCESS_TOKEN` jamais vai para o frontend. O `PUBLIC_KEY` é seguro para o browser.

---

## Arquitetura do Módulo

```
src/
└── payments/
    ├── payments.module.ts          ← imports, providers, exports
    ├── payments.controller.ts      ← rotas REST
    ├── payments.service.ts         ← lógica de negócio
    ├── webhook.controller.ts       ← endpoint dedicado ao webhook MP
    ├── subscriptions.service.ts    ← planos + assinaturas recorrentes
    ├── boleto.service.ts           ← emissão + alertas + baixa
    ├── pix.service.ts              ← QR Code + Copia e Cola
    ├── alerts/
    │   ├── alerts.processor.ts     ← Bull worker (boletos a vencer/vencidos)
    │   └── alerts.scheduler.ts     ← cron que enfileira jobs
    ├── dto/
    │   ├── create-payment.dto.ts
    │   ├── create-subscription.dto.ts
    │   └── webhook-event.dto.ts
    ├── guards/
    │   └── webhook-signature.guard.ts
    └── interfaces/
        └── payment-status.enum.ts
```

---

## Bootstrap Rápido — `payments.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MercadoPagoConfig } from 'mercadopago';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions.service';
import { PixService } from './pix.service';
import { BoletoService } from './boleto.service';
import { WebhookController } from './webhook.controller';
import { AlertsProcessor } from './alerts/alerts.processor';
import { AlertsScheduler } from './alerts/alerts.scheduler';

export const MP_CLIENT = 'MP_CLIENT';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'payment-alerts' }),
  ],
  controllers: [PaymentsController, WebhookController],
  providers: [
    {
      provide: MP_CLIENT,
      useFactory: () =>
        new MercadoPagoConfig({
          accessToken: process.env.MP_ACCESS_TOKEN!,
          options: { timeout: 10_000 },
        }),
    },
    PaymentsService,
    SubscriptionsService,
    PixService,
    BoletoService,
    AlertsProcessor,
    AlertsScheduler,
  ],
  exports: [PaymentsService, SubscriptionsService],
})
export class PaymentsModule {}
```

---

## Status de Pagamento — Enum Canônico

```typescript
// interfaces/payment-status.enum.ts
export enum PaymentStatus {
  PENDING   = 'pending',    // aguardando pagamento
  APPROVED  = 'approved',   // pago / baixado
  REJECTED  = 'rejected',   // recusado
  CANCELLED = 'cancelled',  // cancelado manualmente
  REFUNDED  = 'refunded',   // estornado
  IN_PROCESS = 'in_process',// em análise antifraude
  IN_MEDIATION = 'in_mediation',
  CHARGED_BACK = 'charged_back',
}

export enum SubscriptionStatus {
  AUTHORIZED = 'authorized',
  PAUSED     = 'paused',
  CANCELLED  = 'cancelled',
  PENDING    = 'pending',
}
```

---

## Fluxo Geral de Pagamento

```
Cliente → POST /payments/pix|boleto
            ↓
        PixService|BoletoService.create()
            ↓
        MP API → retorna payment_id + QR/código
            ↓
        Salva no banco (status=PENDING)
            ↓
        MP faz POST no /payments/webhook
            ↓
        WebhookController valida assinatura
            ↓
        Busca payment no MP API (consulta real)
            ↓
        Atualiza banco → status=APPROVED
            ↓
        Emite evento (EventEmitter2 / fila)
            ↓
        Envia e-mail/notificação ao cliente
```

---

## Checklist de Implementação

- [ ] Ler `references/config-credentials.md` — configurar credenciais e sandbox
- [ ] Ler `references/nestjs-module.md` — estrutura e DI do módulo
- [ ] Implementar o payment method desejado (pix / boleto / subscription)
- [ ] Ler `references/webhook.md` — configurar e validar webhook ANTES de ir para produção
- [ ] Ler `references/nextjs-frontend.md` — renderizar QR Code e formulários
- [ ] Testar com credenciais de sandbox (usuários de teste)
- [ ] Configurar Bull + Redis para alertas de boleto
- [ ] Habilitar webhook na conta do MP: https://www.mercadopago.com.br/developers/pt/docs/notifications

---

## Regras Críticas

1. **Sempre valide a assinatura do webhook** — veja `references/webhook.md`. Nunca processe notificação sem verificar o header `x-signature`.
2. **Nunca confie só na notificação** — após receber o webhook, sempre consulte `GET /v1/payments/{id}` para confirmar o status real.
3. **Idempotência** — use `X-Idempotency-Key` em toda criação de pagamento para evitar duplicatas em retentativas.
4. **IPN está sendo descontinuado** — use Webhooks com validação de assinatura.
5. **Boleto expira em até 30 dias** — após esse prazo, o cancelamento é automático. Configure `date_of_expiration` explicitamente (mínimo 3 dias úteis para aprovação).
6. **PIX expira** — o QR Code e o código Copia e Cola têm validade. Informe o cliente e implemente reemissão se necessário.
