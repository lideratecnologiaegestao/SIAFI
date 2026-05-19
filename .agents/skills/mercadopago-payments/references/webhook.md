# Webhook — Validação de Assinatura e Processamento de Eventos

## ⚠️ Regra de Ouro

**Nunca processe um webhook sem validar a assinatura.** Qualquer pessoa pode fazer um POST
para a sua URL. A validação garante que o evento veio do Mercado Pago.

---

## `webhook-signature.guard.ts`

```typescript
import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req: Request = context.switchToHttp().getRequest();
    const secret = process.env.MP_WEBHOOK_SECRET;

    if (!secret) {
      this.logger.warn('MP_WEBHOOK_SECRET não configurado — webhook não validado');
      return true; // só durante desenvolvimento local
    }

    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;

    if (!xSignature) {
      throw new UnauthorizedException('x-signature ausente');
    }

    // Extrai ts e v1 do header: "ts=...;v1=..."
    const parts = Object.fromEntries(
      xSignature.split(';').map((p) => p.split('=')),
    );
    const ts = parts['ts'];
    const receivedHash = parts['v1'];

    // Monta o manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>"
    const dataId = (req.body as any)?.data?.id ?? '';
    const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts}`;

    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    if (expectedHash !== receivedHash) {
      this.logger.warn(`Assinatura inválida. manifest="${manifest}"`);
      throw new UnauthorizedException('Assinatura webhook inválida');
    }

    return true;
  }
}
```

---

## `webhook.controller.ts`

```typescript
import {
  Controller, Post, Body, Headers, HttpCode,
  UseGuards, Logger,
} from '@nestjs/common';
import { WebhookSignatureGuard } from './guards/webhook-signature.guard';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions.service';

interface WebhookEvent {
  action: string;    // "payment.created" | "payment.updated" | "updated"
  type: string;      // "payment" | "subscription_preapproval" | "plan"
  data: { id: string };
  live_mode: boolean;
}

@Controller('payments/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private paymentsService: PaymentsService,
    private subscriptionsService: SubscriptionsService,
  ) {}

  @Post()
  @HttpCode(200)
  @UseGuards(WebhookSignatureGuard)
  async handleWebhook(
    @Body() event: WebhookEvent,
    @Headers('x-request-id') requestId: string,
  ) {
    this.logger.log(`Webhook recebido: type=${event.type} action=${event.action} id=${event.data?.id}`);

    try {
      switch (event.type) {
        case 'payment':
          await this.paymentsService.processPaymentEvent(event.data.id);
          break;

        case 'subscription_preapproval':
          await this.subscriptionsService.processSubscriptionEvent(event.data.id);
          break;

        default:
          this.logger.warn(`Tipo de evento desconhecido: ${event.type}`);
      }
    } catch (err) {
      // IMPORTANTE: sempre retorne 200 para o MP mesmo em erros internos.
      // Se retornar 4xx/5xx, o MP vai retentar e pode criar duplicatas.
      this.logger.error(`Erro ao processar webhook ${event.type}:${event.data?.id}`, err);
    }

    return { received: true };
  }
}
```

---

## `payments.service.ts` — Método de Processamento

```typescript
async processPaymentEvent(paymentId: string) {
  // Passo 1: Consulta o MP para status real (nunca confie só no evento)
  const mpPayment = await this.paymentClient.get({ id: Number(paymentId) });

  // Passo 2: Atualiza o banco
  const updated = await this.prisma.payment.update({
    where: { mpPaymentId: Number(paymentId) },
    data: {
      status: mpPayment.status,
      paidAt: mpPayment.date_approved
        ? new Date(mpPayment.date_approved)
        : undefined,
    },
  });

  // Passo 3: Dispara ações conforme status
  if (mpPayment.status === 'approved') {
    await this.onPaymentApproved(updated);
  } else if (mpPayment.status === 'cancelled') {
    await this.onPaymentCancelled(updated);
  }

  return updated;
}

private async onPaymentApproved(payment: any) {
  // Notificar cliente, liberar produto/serviço, atualizar assinatura, etc.
  this.eventEmitter.emit('payment.approved', payment);
}
```

---

## Configurar Webhook no Painel do MP

1. Acesse: https://www.mercadopago.com.br/developers/pt/docs/notifications
2. Vá em **Suas integrações** → selecione a aplicação → **Webhooks**
3. Configure a URL: `https://api.seusite.com/payments/webhook`
4. Ative os tópicos:
   - ✅ `payment` (criação e atualização de pagamentos)
   - ✅ `subscription_preapproval` (assinaturas recorrentes)
   - ✅ `subscription_preapproval_plan` (planos)
5. Copie o **Segredo** gerado → salve em `MP_WEBHOOK_SECRET`

---

## Teste Local com ngrok

```bash
# Instale ngrok: https://ngrok.com
ngrok http 3000

# Use a URL gerada como notification_url:
# https://xxxx.ngrok.io/payments/webhook
```

---

## Idempotência no Webhook

O MP pode enviar o mesmo evento mais de uma vez. Proteja-se:

```typescript
async processPaymentEvent(paymentId: string) {
  // Verifique se já processou este evento
  const existing = await this.prisma.webhookLog.findFirst({
    where: { paymentId, processed: true },
  });
  if (existing) {
    this.logger.log(`Evento ${paymentId} já processado — ignorando`);
    return;
  }

  // ... processa ...

  await this.prisma.webhookLog.create({
    data: { paymentId, processed: true, processedAt: new Date() },
  });
}
```

---

## Tabela de Tópicos e Ações

| `type` | `action` | Significado |
|--------|----------|-------------|
| `payment` | `payment.created` | Novo pagamento criado (pending) |
| `payment` | `payment.updated` | Status mudou (approved/cancelled/etc) |
| `subscription_preapproval` | `updated` | Assinatura atualizada (pausa, cancel, nova cobrança) |
| `subscription_preapproval_plan` | `updated` | Plano atualizado |

---

## Estrutura do Payload (sempre)

```json
{
  "id": 113614395815,
  "live_mode": true,
  "type": "payment",
  "action": "payment.updated",
  "date_created": "2025-01-15T10:30:00Z",
  "user_id": "234420836",
  "api_version": "v1",
  "data": {
    "id": "1323479563"
  }
}
```

O `data.id` é o ID do recurso. Para `payment`, consulte `GET /v1/payments/{id}`.
Para `subscription_preapproval`, consulte `GET /preapproval/{id}`.
