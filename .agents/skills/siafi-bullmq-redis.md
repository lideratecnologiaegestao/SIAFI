---
name: siafi-bullmq-redis
description: Use esta skill sempre que o projeto SIAFI precisar integrar BullMQ com Redis no NestJS. Cobre configuração de filas assíncronas para disparos de WhatsApp, Email e processamento de webhooks do Mercado Pago. Acione esta skill quando o usuário mencionar: filas, BullMQ, Redis, workers, processamento assíncrono, retry de notificações, webhook Mercado Pago, Evolution API em fila, ou qualquer tarefa que envolva processamento em background no SIAFI.
---

## Stack e versões obrigatórias
```
@nestjs/bullmq   ^10.x
bullmq           ^5.x
ioredis          ^5.x
nodemailer       (email worker)
@bull-board/nestjs @bull-board/api @bull-board/express  (painel visual)
```

## Estrutura de módulos gerada por esta skill
```
backend/src/
└── modules/
    ├── queue/
    │   ├── queue.module.ts          ← BullModule global + conexão Redis
    │   ├── queue.constants.ts       ← nomes das filas como constantes
    │   ├── queue.interfaces.ts      ← interfaces TypeScript dos jobs
    │   └── redis.config.ts          ← factory de conexão segura (singleton)
    ├── notifications/
    │   ├── notifications.service.ts ← producer: adiciona jobs à fila
    │   └── workers/
    │       ├── whatsapp.worker.ts   ← processa jobs WA da finance-notifications
    │       └── email.worker.ts      ← processa jobs EMAIL da finance-notifications
    └── webhook/
        ├── webhook.controller.ts    ← recebe POST do MP, valida HMAC, enfileira
        └── workers/
            └── payment.worker.ts   ← processa fila payment-processing
```

---

## Regras críticas — NÃO ignorar

### Conexão Redis (Windows Server)
- SEMPRE usar `maxRetriesPerRequest: null` — obrigatório para BullMQ
- SEMPRE usar `enableReadyCheck: false` — obrigatório no Windows Server
- SEMPRE usar TLS quando `REDIS_TLS=true` (produção)
- Uma única instância Redis compartilhada entre todas as filas (singleton)

```typescript
// redis.config.ts — padrão obrigatório
export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST,
  port: +process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null,   // obrigatório BullMQ
  enableReadyCheck: false,      // obrigatório Windows Server
  retryStrategy: (times) => Math.min(times * 1000, 30000),
});
```

### Nomes de filas — usar SEMPRE as constantes
```typescript
// queue.constants.ts
export const QUEUE_FINANCE_NOTIFICATIONS = 'finance-notifications';
export const QUEUE_PAYMENT_PROCESSING    = 'payment-processing';

export const JOB_WA_LEMBRETE_VENCIMENTO   = 'whatsapp.lembrete-vencimento';
export const JOB_WA_COBRANCA_ATRASO       = 'whatsapp.cobranca-atraso';
export const JOB_WA_CONFIRMACAO_PAGAMENTO = 'whatsapp.confirmacao-pagamento';
export const JOB_WA_PORTAL_ATIVADO        = 'whatsapp.portal-ativado';
export const JOB_EMAIL_LEMBRETE           = 'email.lembrete-vencimento';
export const JOB_EMAIL_CONFIRMACAO        = 'email.confirmacao-pagamento';
export const JOB_EMAIL_PORTAL_ATIVADO     = 'email.portal-ativado';
export const JOB_PAYMENT_WEBHOOK          = 'payment.webhook';
export const JOB_PAYMENT_CONCILIACAO      = 'payment.conciliacao';
```

### Configuração das filas (defaultJobOptions)
```typescript
// finance-notifications
attempts: 3, backoff: { type: 'exponential', delay: 5000 }
removeOnComplete: { count: 100 }, removeOnFail: { count: 500 }

// payment-processing
attempts: 5, backoff: { type: 'exponential', delay: 10000 }
removeOnComplete: { count: 200 }, removeOnFail: { count: 1000 }
```

### Idempotência obrigatória (prevenir duplicatas)
```typescript
// Pagamentos — nunca processar o mesmo paymentId duas vezes
queue.add(JOB_PAYMENT_WEBHOOK, data, { jobId: `mp-${paymentId}` })

// Lembretes diários — nunca enviar duas vezes no mesmo dia
queue.add(JOB_WA_LEMBRETE_VENCIMENTO, data, {
  jobId: `lembrete-${installmentId}-${format(new Date(), 'yyyy-MM-dd')}`
})
```

### Webhook Mercado Pago — regras de segurança
- Validar HMAC-SHA256 ANTES de enfileirar — rejeitar se inválido
- Usar `crypto.timingSafeEqual()` na comparação (previne timing attacks)
- Retornar `200 OK` IMEDIATAMENTE após enfileirar (não aguardar worker)
- Processar o pagamento real consultando a API do MP no worker

### Worker de pagamento — $transaction obrigatório
Ao processar pagamento aprovado, usar `prisma.$transaction()`:
1. Criar `Payment`
2. Atualizar `totalPago` da `Installment`
3. Se pago: status = `pago`
4. Se todas pagas: loan.status = `quitado`
5. Criar `Transaction` no caixa (entrada)
Se qualquer etapa falhar: rollback completo.

### Dead-letter — falhas que esgotaram tentativas
```typescript
// Em todo worker, implementar onFailed:
@OnWorkerEvent('failed')
async onFailed(job: Job, error: Error) {
  await this.prisma.auditLog.create({
    data: {
      acao: `${job.name.toUpperCase()}_FALHOU`,
      entidade: 'queue',
      dados: { jobId: job.id, erro: error.message, data: job.data },
    }
  });
}
```

---

## Interfaces dos jobs

```typescript
// NotificationJobData
interface NotificationJobData {
  clientId: number
  clienteNome: string
  clienteWhatsapp?: string
  clienteEmail?: string
  loanId?: number
  installmentId?: number
  valorParcela?: number
  dataVencimento?: string
  senhaTemporaria?: string
  templateVars?: Record<string, string>
}

// PaymentJobData
interface PaymentJobData {
  paymentId: string
  externalReference: string
  status: string
  amount: number
  dateApproved?: string
  installmentId?: number
  origem: 'webhook' | 'cron' | 'manual'
}
```

---

## Variáveis de ambiente obrigatórias
```env
REDIS_HOST=redis-host.exemplo.com
REDIS_PORT=6379
REDIS_PASSWORD=senha_segura
REDIS_TLS=true

MP_WEBHOOK_SECRET=chave_hmac_mp
MP_ACCESS_TOKEN=APP_USR-...

EVOLUTION_API_URL=https://evolution.lidera.app.br
EVOLUTION_API_KEY=chave_evolution
EVOLUTION_INSTANCE=lidera

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@lidera.com
SMTP_PASS=senha_app
SMTP_FROM="Lidera Financeira <noreply@lidera.com>"
```

---

## Concorrência dos workers
- `whatsapp.worker`: `{ concurrency: 5 }`
- `email.worker`: `{ concurrency: 3 }`
- `payment.worker`: `{ concurrency: 3 }` — baixo para evitar race conditions

## BullBoard — painel de monitoramento
- Rota: `/admin/queues`
- Proteger com middleware que verifica JWT + role `admin`
- Nunca expor publicamente

## Checklist de validação pós-implementação
- [ ] Redis conectando sem erros no startup
- [ ] BullBoard acessível em /admin/queues com login admin
- [ ] Job de WhatsApp enfileirado e processado com sucesso
- [ ] Retry funcionando: job com erro é reprocessado automaticamente
- [ ] Idempotência: mesmo paymentId não gera dois jobs
- [ ] HMAC do webhook MP sendo validado corretamente
- [ ] AuditLog registrando jobs que esgotaram tentativas
- [ ] $transaction revertendo corretamente em caso de falha
