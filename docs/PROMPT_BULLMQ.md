---

```
Você é um Engenheiro de Software Sênior especializado em NestJS, BullMQ e
arquiteturas de filas resilientes para sistemas financeiros. Analise a
documentação do SIAFI 2.0 (Backend e Database) e implemente a integração
completa de filas assíncronas com BullMQ + Redis.

O SIAFI roda em Windows Server com NestJS 10, Prisma e PostgreSQL (Supabase).
As filas são críticas para o negócio: falha no envio de WhatsApp ou no
processamento de pagamento deve ser retentada automaticamente, nunca
silenciada.

---

## 1. INSTALAÇÃO E DEPENDÊNCIAS

Gere os comandos de instalação:
```bash
npm install @nestjs/bullmq bullmq ioredis
npm install @bull-board/nestjs @bull-board/api @bull-board/express
```

---

## 2. VARIÁVEIS DE AMBIENTE

Adicione ao `backend/.env.example` (com comentários explicativos):
```env
# ── Redis ──────────────────────────────────────────
REDIS_HOST=redis-host.exemplo.com
REDIS_PORT=6379
REDIS_PASSWORD=senha_segura_aqui
REDIS_TLS=true                    # true em produção, false em dev local

# ── Mercado Pago ───────────────────────────────────
MP_WEBHOOK_SECRET=chave_hmac_do_painel_mp
MP_ACCESS_TOKEN=APP_USR-000000000000000-000000-...

# ── Evolution API (WhatsApp) ───────────────────────
EVOLUTION_API_URL=https://evolution.lidera.app.br
EVOLUTION_API_KEY=chave_api_evolution
EVOLUTION_INSTANCE=lidera

# ── SMTP (Email) ───────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@lidera.com
SMTP_PASS=senha_de_app_gmail
SMTP_FROM="Lidera Financeira <noreply@lidera.com>"
```

---

## 3. CONEXÃO REDIS — `src/modules/queue/redis.config.ts`

Implemente uma factory de conexão singleton com as seguintes regras:
- Usar `ioredis` com TLS quando `REDIS_TLS=true`
- Opções obrigatórias para compatibilidade com BullMQ:
  `enableReadyCheck: false` e `maxRetriesPerRequest: null`
- Reconnect automático com backoff exponencial (máx 30s)
- Log de conexão/desconexão usando o `Logger` do NestJS
- Exportar a instância para ser reutilizada em `BullModule` e workers

```typescript
// Estrutura esperada:
export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST,
  port: +process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  maxRetriesPerRequest: null,      // obrigatório para BullMQ
  enableReadyCheck: false,         // obrigatório para Windows/BullMQ
  retryStrategy: (times) => Math.min(times * 1000, 30000),
});
```

---

## 4. CONSTANTES DAS FILAS — `src/modules/queue/queue.constants.ts`

```typescript
export const QUEUE_FINANCE_NOTIFICATIONS = 'finance-notifications';
export const QUEUE_PAYMENT_PROCESSING    = 'payment-processing';

// Job names — finance-notifications
export const JOB_WA_LEMBRETE_VENCIMENTO    = 'whatsapp.lembrete-vencimento';
export const JOB_WA_COBRANCA_ATRASO        = 'whatsapp.cobranca-atraso';
export const JOB_WA_CONFIRMACAO_PAGAMENTO  = 'whatsapp.confirmacao-pagamento';
export const JOB_WA_PORTAL_ATIVADO         = 'whatsapp.portal-ativado';
export const JOB_EMAIL_LEMBRETE            = 'email.lembrete-vencimento';
export const JOB_EMAIL_CONFIRMACAO         = 'email.confirmacao-pagamento';
export const JOB_EMAIL_PORTAL_ATIVADO      = 'email.portal-ativado';

// Job names — payment-processing
export const JOB_PAYMENT_WEBHOOK           = 'payment.webhook';
export const JOB_PAYMENT_CONCILIACAO       = 'payment.conciliacao';
```

---

## 5. MÓDULO DE FILAS — `src/modules/queue/queue.module.ts`

Implemente um `@Global()` QueueModule que:
- Registre as duas filas via `BullModule.registerQueue()`
- Use a conexão Redis singleton do `redis.config.ts`
- Configure os defaults de cada fila:

```typescript
// finance-notifications
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
}

// payment-processing
defaultJobOptions: {
  attempts: 5,
  backoff: { type: 'exponential', delay: 10000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 1000 },
}
```

- Configure e exporte o BullBoard em `/admin/queues`
  (protegido por middleware que verifica role `admin` no JWT)
- Exporte ambas as filas para uso nos outros módulos

---

## 6. INTERFACES DOS JOBS — `src/modules/queue/queue.interfaces.ts`

Defina as interfaces TypeScript para os dados de cada job:

```typescript
// Dados para jobs de notificação
export interface NotificationJobData {
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

// Dados para jobs de pagamento
export interface PaymentJobData {
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

## 7. FILA `finance-notifications` — PRODUCER E WORKERS

### 7a. NotificationsService (producer)
Refatore o `src/modules/notifications/notifications.service.ts` existente
para usar a fila ao invés de chamar a Evolution API diretamente:

```typescript
// Métodos que devem enfileirar jobs (não chamar API diretamente):

async enviarLembreteVencimento(clientId: number, installmentId: number)
  → add(JOB_WA_LEMBRETE_VENCIMENTO, data)
  → add(JOB_EMAIL_LEMBRETE, data)  // se cliente tiver email

async enviarCobrancaAtraso(clientId: number, installmentId: number)
  → add(JOB_WA_COBRANCA_ATRASO, data)

async enviarConfirmacaoPagamento(clientId: number, paymentId: number)
  → add(JOB_WA_CONFIRMACAO_PAGAMENTO, data)
  → add(JOB_EMAIL_CONFIRMACAO, data)

async enviarAcessoPortal(clientId: number, senhaTemporaria: string)
  → add(JOB_WA_PORTAL_ATIVADO, data)
  → add(JOB_EMAIL_PORTAL_ATIVADO, data)
```

### 7b. WhatsApp Worker — `workers/whatsapp.worker.ts`
Implemente o `@Processor(QUEUE_FINANCE_NOTIFICATIONS)` que:
- Usa `@Process(JOB_WA_*)` para cada tipo de job WhatsApp
- Chama a Evolution API via `axios` com os dados do job
- Em caso de erro HTTP 4xx da Evolution (ex: instância desconectada):
  lançar erro para o BullMQ retentar
- Em caso de erro HTTP 5xx: lançar erro para retry
- Após esgotar todas as tentativas (`onFailed`): registrar no `AuditLog`
  com `{ acao: 'WHATSAPP_FALHOU', dados: { jobId, erro, clientId } }`
- Concorrência: `{ concurrency: 5 }`

Templates de mensagem para cada job name:
```typescript
// whatsapp.lembrete-vencimento
`Olá, ${nome}! 👋
Sua parcela de *R$ ${valor}* vence em *${dataVencimento}*.
Pague com PIX pelo portal: https://financeiro.lidera.app.br/portal`

// whatsapp.cobranca-atraso
`Olá, ${nome}. Identificamos que sua parcela de *R$ ${valor}* 
está em atraso. Entre em contato para regularizar: (65) 99999-9999`

// whatsapp.confirmacao-pagamento
`✅ Pagamento confirmado!
Valor: *R$ ${valor}*
Obrigado pela pontualidade, ${nome}!`

// whatsapp.portal-ativado
`Olá, ${nome}! 👋
Seu acesso ao portal Lidera foi ativado.
🔐 Senha temporária: *${senhaTemporaria}*
🌐 https://financeiro.lidera.app.br/portal
⚠️ Troque sua senha no primeiro acesso.`
```

### 7c. Email Worker — `workers/email.worker.ts`
Implemente o worker de email usando `nodemailer`:
- Instalar: `npm install nodemailer @types/nodemailer`
- Usar as variáveis SMTP do `.env`
- Templates HTML simples com:
  - Logo da empresa (URL pública)
  - Conteúdo da mensagem
  - Botão de ação (quando aplicável)
  - Footer com dados da empresa
- Concorrência: `{ concurrency: 3 }`
- Após esgotar tentativas: registrar no `AuditLog`

---

## 8. FILA `payment-processing` — WEBHOOK E WORKER

### 8a. WebhookController — refatorar existente
Refatore `src/modules/webhook/webhook.controller.ts`:

```typescript
@Post('mercadopago')
async handleMercadoPago(
  @Headers('x-signature') signature: string,
  @Headers('x-request-id') requestId: string,
  @Body() body: any,
  @Req() req: Request,
) {
  // 1. Validar HMAC-SHA256 imediatamente
  //    Se inválido: throw UnauthorizedException (não enfileirar)
  
  // 2. Extrair paymentId do body
  const paymentId = body?.data?.id?.toString();
  
  // 3. Enfileirar com jobId para idempotência:
  await this.paymentQueue.add(
    JOB_PAYMENT_WEBHOOK,
    { paymentId, externalReference: body?.data?.id, 
      status: body?.action, amount: 0, origem: 'webhook' },
    { 
      jobId: `mp-${paymentId}`,  // ← previne duplo processamento
      priority: 1,               // ← alta prioridade
    }
  );
  
  // 4. Retornar 200 IMEDIATAMENTE (não aguardar processamento)
  return { received: true };
}
```

Validação HMAC obrigatória:
```typescript
private validateMercadoPagoSignature(
  signature: string,
  requestId: string,
  body: any,
): boolean {
  // Implementar conforme documentação oficial do MP:
  // https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
  // Usar crypto.createHmac('sha256', MP_WEBHOOK_SECRET)
  // Comparar com crypto.timingSafeEqual() (previne timing attacks)
}
```

### 8b. PaymentWorker — `workers/payment.worker.ts`
Implemente `@Processor(QUEUE_PAYMENT_PROCESSING)` que:

Para `JOB_PAYMENT_WEBHOOK`:
1. Consultar o status real do pagamento na API do MP:
   `GET https://api.mercadopago.com/v1/payments/{paymentId}`
2. Verificar se `externalReference` corresponde a uma parcela no banco
3. Se status = `approved`:
   - Usar `$transaction` do Prisma:
     a. Criar `Payment` na tabela payments
     b. Atualizar `totalPago` da `Installment`
     c. Se parcela quitada: atualizar status para `pago`
     d. Se todas parcelas do loan quitadas: atualizar loan para `quitado`
     e. Criar `Transaction` no caixa (entrada)
   - Enfileirar job de confirmação WhatsApp/Email:
     `notificationsQueue.add(JOB_WA_CONFIRMACAO_PAGAMENTO, ...)`
4. Se status = `pending` ou `in_process`: logar e não processar
5. Se status = `rejected` ou `cancelled`: logar no AuditLog
6. Registrar resultado no `AuditLog` sempre

Para `JOB_PAYMENT_CONCILIACAO` (cron job diário):
- Buscar todos os `PixPayment` com status `pendente` há mais de 1 hora
- Consultar status na API do MP para cada um
- Processar os aprovados que não receberam webhook

Concorrência: `{ concurrency: 3 }` — não processar muitos pagamentos 
simultaneamente para evitar race conditions no banco

---

## 9. INTEGRAÇÃO COM CRON JOBS EXISTENTES

Refatore `src/modules/cron/cron.service.ts` para usar as filas:

```typescript
// Antes (chamada direta):
@Cron('0 9 * * *')
async sendReminders() {
  // chamava Evolution API diretamente
}

// Depois (enfileira jobs):
@Cron('0 9 * * *')
async sendReminders() {
  const parcelasProximas = await this.prisma.installment.findMany({
    where: {
      status: 'pendente',
      dataVencimento: {
        gte: new Date(),
        lte: addDays(new Date(), 3),
      }
    },
    include: { loan: { include: { client: true } } }
  });

  // Enfileirar um job por parcela (não chamar API em loop)
  for (const parcela of parcelasProximas) {
    await this.notificationsQueue.add(
      JOB_WA_LEMBRETE_VENCIMENTO,
      {
        clientId: parcela.loan.clientId,
        clienteNome: parcela.loan.client.nome,
        clienteWhatsapp: parcela.loan.client.whatsapp,
        installmentId: parcela.id,
        valorParcela: parcela.valor.toNumber(),
        dataVencimento: format(parcela.dataVencimento, 'dd/MM/yyyy'),
      },
      {
        jobId: `lembrete-${parcela.id}-${format(new Date(), 'yyyy-MM-dd')}`,
      }
    );
  }
}
```

Aplicar o mesmo padrão para:
- `sendOverdueNotices` (cobranças de atraso — 10:00)
- Qualquer outro cron que chame a Evolution API diretamente

---

## 10. BULLBOARD — PAINEL DE MONITORAMENTO

Configure o BullBoard para monitorar as filas em tempo real:
- Rota: `/admin/queues`
- Middleware de autenticação: verificar JWT + role `admin` antes de 
  renderizar o painel
- Exibir: jobs ativos, aguardando, concluídos, falhos e atrasados
- Permitir: reprocessar job falho manualmente pelo painel

---

## 11. TESTES MANUAIS — COMANDOS PARA VALIDAR

Gere um arquivo `src/modules/queue/queue.debug.ts` com métodos de teste:

```typescript
// Métodos para testar manualmente via endpoint de debug (apenas dev):

// Testar envio WhatsApp
POST /api/debug/queue/test-whatsapp
{ "clientId": 1, "tipo": "lembrete-vencimento" }

// Testar processamento de pagamento
POST /api/debug/queue/test-payment
{ "paymentId": "123456789", "status": "approved" }

// Ver status das filas
GET /api/debug/queue/status
```

Proteger esses endpoints com:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
// E verificar NODE_ENV !== 'production' antes de executar
```

---

## 12. ENTREGÁVEIS (nesta ordem)

1. Comandos de instalação das dependências
2. Variáveis de ambiente (`.env.example` atualizado)
3. `redis.config.ts` — conexão singleton com TLS e reconnect
4. `queue.constants.ts` — todas as constantes
5. `queue.interfaces.ts` — interfaces TypeScript dos jobs
6. `queue.module.ts` — registro das filas + BullBoard
7. `notifications.service.ts` refatorado (producer)
8. `whatsapp.worker.ts` — com todos os templates
9. `email.worker.ts` — com nodemailer e templates HTML
10. `webhook.controller.ts` refatorado — HMAC + enfileirar
11. `payment.worker.ts` — lógica completa com $transaction
12. `cron.service.ts` refatorado — usando filas
13. `queue.debug.ts` — endpoints de teste
14. Atualização do `app.module.ts` importando `QueueModule`

## REGRAS TÉCNICAS OBRIGATÓRIAS
- NUNCA chamar Evolution API ou SMTP diretamente nos Controllers
- NUNCA usar `Math.random()` ou `setTimeout()` para retry — usar o 
  backoff nativo do BullMQ
- SEMPRE usar `jobId` para idempotência em pagamentos e lembretes diários
- SEMPRE usar `$transaction` do Prisma ao processar pagamentos
- SEMPRE retornar 200 no webhook ANTES de processar (processar na fila)
- SEMPRE validar HMAC do Mercado Pago antes de enfileirar
- Registrar no `AuditLog` toda falha que esgotou as tentativas
- `crypto.timingSafeEqual()` na comparação HMAC (prevenir timing attacks)
- Proteger `/admin/queues` com autenticação — nunca expor publicamente
```
