# SIAFI 2.0 — Guia do Backend (NestJS)

> Última atualização: 2026-05-22 | NestJS 10 · TypeScript 5 · Prisma 5

---

## Estrutura de Módulos (24)

```
backend/src/
├── main.ts                    → Bootstrap, Helmet, CORS, ValidationPipe global
├── app.module.ts              → Importa todos os 24 módulos
├── prisma/                    → PrismaService singleton
├── supabase/                  → SupabaseService (Admin API + Storage)
└── modules/
    ├── auth/                  → Login, MFA, refresh, logout, Google OAuth
    ├── users/                 → CRUD operadores com roles
    ├── clients/               → Clientes + documentos + consultor
    ├── loans/                 → Contratos, parcelas, aceite, liberação capital
    ├── installments/          → Parcelas, overdue, split, mora
    ├── payments/              → Pagamentos e estorno
    ├── transactions/          → Caixa manual
    ├── pix/                   → QR Code via Mercado Pago
    ├── webhook/               → Callback MP → PaymentWorker
    ├── renegociacoes/         → Renegociação simples
    ├── reparcelamento/        → Fluxo completo de reparcelamento
    ├── intencao/              → Intenções com SLA e auto-aprovação
    ├── score-risco/           → Score ponderado por cliente
    ├── consultor/             → Carteira, cobranças, solicitações
    ├── mensagem/              → Chat interno + Supabase Realtime
    ├── cobranca/              → Cobrança antecipada + PDF
    ├── notifications/         → EmailWorker + WhatsappWorker (BullMQ)
    ├── reports/               → Relatórios financeiros
    ├── client-portal/         → Portal do cliente
    ├── cron/                  → 10 jobs agendados
    ├── audit/                 → AuditLog
    ├── settings/              → SiteSetting (configurações)
    ├── pdf/                   → PDFKit bufferizado
    └── queue/                 → Constantes e interfaces BullMQ
```

---

## Padrão de Controller

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('endpoint')
export class MeuController {
  constructor(private readonly svc: MeuService) {}

  @Get()
  @Roles('admin', 'financeiro')
  findAll(@Query() filters: FilterDto) {
    return this.svc.findAll(filters);
  }
}
// Regra: rotas estáticas SEMPRE antes de /:id
// Ex: GET /clients/stats antes de GET /clients/:id
```

---

## Endpoints por Módulo

### Auth `/api/auth`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| POST | `/login` | público | Login username+senha |
| POST | `/refresh` | público | Renovar JWT |
| POST | `/logout` | autenticado | Invalidar sessão |
| GET | `/me` | autenticado | Dados do usuário atual |
| POST | `/mfa/verify` | autenticado | Verificar TOTP |
| POST | `/google/validate` | público | Login via Google OAuth |

### Users `/api/users`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin | Lista paginada |
| POST | `/` | admin | Criar operador |
| PATCH | `/:id` | admin | Atualizar |
| DELETE | `/:id` | admin | Soft-delete |

### Clients `/api/clients`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin,financeiro,caixa | Lista paginada (search, status) |
| GET | `/stats` | admin,financeiro,caixa | Totais rápidos |
| GET | `/consultores` | admin,financeiro,consultor | Lista de consultores ativos |
| GET | `/quitados` | admin,financeiro,caixa | Clientes com loan quitado |
| GET | `/:id` | admin,financeiro,caixa | Detalhe + loans |
| GET | `/:id/document-urls` | admin,financeiro,caixa | URLs assinadas (1h) |
| POST | `/` | admin,financeiro,consultor | Criar (multipart: foto, rg, comprovante) |
| PATCH | `/:id/vincular-consultor` | admin,financeiro | Vincular/desvincular consultor |
| PATCH | `/:id` | admin,financeiro | Atualizar |
| DELETE | `/:id` | admin | Soft-delete |

### Loans `/api/loans`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin,financeiro | Lista paginada (search, status, clientId) |
| GET | `/stats` | admin,financeiro | KPIs de carteira |
| GET | `/:id` | admin,financeiro,caixa | Detalhe + parcelas + cliente |
| POST | `/` | admin,financeiro | Criar com geração automática de parcelas |
| PATCH | `/:id/cancel` | admin,financeiro | Cancelar contrato |
| PATCH | `/:id/liberar-capital` | admin,financeiro,caixa | Confirmar entrega de capital |

**Body de criação:**
```json
{
  "clientId": 1,
  "valor": 5000.00,
  "valorInvestido": 4500.00,
  "valorParcela": 1100.00,
  "numeroParcelas": 5,
  "dataInicio": "2026-06-01",
  "diaVencimento": 5,
  "metodoPagamento": "pix",
  "multaPercentual": 0.02,
  "moraDiariaPercentual": 0.001,
  "diasAntecedenciaCobranca": 10,
  "cobrarWhatsapp": true,
  "cobrarEmail": true,
  "cobrarPortal": true,
  "observacoes": ""
}
```

### Installments `/api/installments`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/overdue` | admin,financeiro,caixa | Parcelas em atraso |
| GET | `/:id` | admin,financeiro,caixa | Detalhe da parcela |
| POST | `/mark-overdue` | sistema | Marca vencidas (cron) |

### Payments `/api/payments`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin,financeiro,caixa | Histórico paginado |
| POST | `/` | admin,financeiro,caixa | Registrar pagamento |
| DELETE | `/:id/estornar` | admin,financeiro | Estornar pagamento |

**Body de pagamento:**
```json
{
  "installmentId": 42,
  "valor": 1100.00,
  "dataPagamento": "2026-06-05",
  "metodoPagamento": "pix",
  "observacoes": ""
}
```

### Transactions `/api/transactions`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin,financeiro,caixa | Lista paginada |
| GET | `/saldo` | admin,financeiro,caixa | Saldo atual do caixa |
| GET | `/movimento` | admin,financeiro,caixa | Movimentação por período |
| POST | `/` | admin,financeiro,caixa | Lançamento manual |

### Reports `/api/reports`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/carteira` | admin,financeiro | Visão geral da carteira |
| GET | `/faturamento?mes=YYYY-MM` | admin,financeiro | Faturamento por consultor |
| GET | `/clientes` | admin,financeiro | Clientes ativos com próxima parcela |
| GET | `/movimentacao` | admin,financeiro | Extrato por período |
| GET | `/contratos?status=` | admin,financeiro | Lista de contratos filtrada |

### Reparcelamento `/api/reparcelamentos`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin,financeiro,consultor | Lista com filtros |
| GET | `/:id` | admin,financeiro,consultor | Detalhe |
| POST | `/` | admin,financeiro,consultor | Criar solicitação |
| POST | `/simular` | admin,financeiro,consultor | Simulação (sem gravar) |
| PATCH | `/:id/proposta` | admin,financeiro | Enviar proposta |
| PATCH | `/:id/aprovar` | admin | Aprovar (2ª instância) |
| PATCH | `/:id/rejeitar` | admin,financeiro | Rejeitar |
| PATCH | `/:id/executar` | admin,financeiro | Executar atomicamente |

**Execução atômica (`$transaction`):**
1. Cancela loan original + parcelas não pagas → `cancelado`
2. Cria novo loan com `origemLoanId` + `reparcelamentoCount + 1`
3. Grava `aceiteClienteHash` (SHA-256)
4. Atualiza `SolicitacaoReparcelamento` → `executado`
5. Recalcula score de risco (fire-and-forget)

### Intenções `/api/intencoes`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin,financeiro,consultor | Lista com SLA |
| GET | `/:id` | admin,financeiro,consultor | Detalhe |
| POST | `/` | admin,financeiro,consultor | Criar intenção |
| PATCH | `/:id/aprovar` | admin,financeiro | Aprovar → cria loan automaticamente |
| PATCH | `/:id/rejeitar` | admin,financeiro | Rejeitar |
| PATCH | `/:id/feedback` | admin,financeiro | Feedback sem decisão |

### Score de Risco `/api/score-risco`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/:clientId` | admin,financeiro,consultor | Score atual + histórico |
| POST | `/recalcular/:clientId` | admin,financeiro | Forçar recálculo |

**Fórmula:** `(pontualidade × 0.50) + (reparcelamentos × 0.30) + (quitações × 0.20)` → 0–100

**Trigger automático (fire-and-forget):** após pagamentos, estornos, markOverdue, execução de reparcelamento. Nunca propaga erros.

### Consultor `/api/consultor`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/carteira` | consultor,admin,financeiro | Clientes da carteira |
| GET | `/carteira/:clientId` | consultor,admin,financeiro | Detalhe do cliente |
| GET | `/solicitacoes` | consultor,admin,financeiro | Solicitações pendentes |
| GET | `/cobrancas` | consultor,admin,financeiro | Cobranças em atraso |

### Mensagens `/api/mensagens`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/badge` | todos | Contagem de não-lidas |
| GET | `/conversas` | todos | Lista com `naoLidas` por conversa |
| GET | `/conversas/:id` | todos | Mensagens + marca `ultimaLeitura` |
| POST | `/conversas` | todos | Criar conversa (idempotente) |
| POST | `/conversas/:id` | todos | Enviar mensagem |

### Portal do Cliente `/api/portal`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/me` | cliente | Perfil próprio |
| GET | `/loans` | cliente | Contratos (sem campos internos) |
| GET | `/installments` | cliente | Parcelas com saldo devedor |
| GET | `/parcelas/:id/boleto` | cliente | URL assinada do boleto |
| POST | `/tickets` | cliente | Abrir ticket de suporte |
| PATCH | `/perfil` | cliente | Atualizar email/whatsapp |

**Campos nunca retornados para clientes:** `principalPayback`, `netGain`, `valorInvestido`

### Portal Admin `/api/portal` (admin routes)

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| POST | `/:id/ativar` | admin,financeiro,consultor | Ativar portal (cria conta Supabase) |
| POST | `/:id/desativar` | admin,financeiro | Desativar (ban Supabase) |
| POST | `/:id/reativar` | admin,financeiro | Reativar |
| POST | `/reenviar-senha` | admin,financeiro,consultor | Nova senha + email + WhatsApp |
| GET | `/:id/status` | admin,financeiro,consultor | Status portal, MFA, senhaTemporaria |

### PIX `/api/pix`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/:installmentId` | admin,financeiro | Buscar PIX existente |
| POST | `/generate` | admin,financeiro | Gerar QR Code |

### Webhook `/api/webhook/mp`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| POST | `/` | público | Callback Mercado Pago |

Valida `MP_WEBHOOK_SECRET` (HMAC-SHA256) antes de processar. Enfileira `payment.process`.

### Audit `/api/audit`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin | Lista com filtros: `acao`, `entidade`, `userId`, `page` |

### Settings `/api/settings`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | `/` | admin | Todos os parâmetros |
| PATCH | `/` | admin | Atualizar parâmetros |

---

## Crons (10 — America/Sao_Paulo)

```typescript
// Todos no CronService com @Cron('expr', { timeZone: 'America/Sao_Paulo' })

@Cron('0 2 * * *')   conciliacaoPix()            // 02h00 — reconcilia PIX MP
@Cron('0 7 * * *')   verificarSlaAceite()         // 07h00 — SLA de aceite de contrato
@Cron('0 8 * * *')   markOverdueInstallments()    // 08h00 — parcelas → atrasado
@Cron('5 8 * * *')   atualizarEncargos()          // 08h05 — multa + mora diária
@Cron('0 9 * * *')   sendPaymentReminders()       // 09h00 — lembretes de vencimento
@Cron('30 9 * * *')  enviarCobrancasAntecipadas() // 09h30 — PDF boleto + multi-canal
@Cron('0 10 * * *')  sendOverdueNotifications()   // 10h00 — notifica inadimplentes
@Cron('0 11 * * *')  lembreteReparcelamentos()    // 11h00 — cobranças de reparcel.
@Cron('0 14 * * *')  reenviarCobrancasNaoLidas()  // 14h00 — reenvio não-lidas
@Cron('0 */2 * * *') verificarSlaIntencoes()      // a cada 2h — SLA de intenções
```

---

## Cálculos Financeiros

Todos os cálculos usam **Decimal.js** (precisão 20, ROUND_HALF_UP). Nunca `Math.round()` ou `parseFloat()` em dinheiro.

```typescript
import Decimal from 'decimal.js';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

// Geração de parcelas
const amt = new Decimal(dto.valorParcela ?? 0);
const dataVenc = calcularDataVencimento(dataInicio, i + 1, dto.diaVencimento);
// diaVencimento: 1–28 → fixa o dia; null → mantém dia do dataInicio

// Mora diária
const mora = saldoDevedor.mul(moraDiaria).toDecimalPlaces(2);
```

---

## Padrões de Código

```typescript
// Rotas estáticas ANTES de dinâmicas
@Get('stats')   // ✅ antes de /:id
@Get(':id')

// Score sempre fire-and-forget
void this.scoreRisco.recalcularScore(clientId); // nunca propagate errors

// Non-null assertion após guard
const loan = await this.prisma.loan.findFirst({ where: { id } });
if (!loan) throw new NotFoundException();
await this.supabase.admin.auth.admin.updateUserById(loan.supabaseId!, { ... });

// Transações atômicas para operações compostas
await this.prisma.$transaction(async (tx) => {
  await tx.loan.update(...);
  await tx.installment.updateMany(...);
  await tx.solicitacaoReparcelamento.update(...);
});
```

---

## Variáveis de Ambiente

```bash
# .env (nunca commitar)

# App
NODE_ENV=development
PORT=4010
APP_URL=https://financeiro.lidera.app.br
FRONTEND_URL=https://financeiro.lidera.app.br,http://localhost:4011

# Banco
DATABASE_URL="postgresql://..."  # pooler pgBouncer :6543
DIRECT_URL="postgresql://..."    # direto :5432 (migrações)

# Supabase
SUPABASE_URL="https://lvpseuaybpnmrneuyndi.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="..."  # nunca no frontend

# JWT
JWT_SECRET="..."
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET="..."
JWT_REFRESH_EXPIRES_IN=7d

# Email (Hostinger)
MAIL_HOST=smtp.hostinger.com
MAIL_PORT=465
MAIL_USER=nao-responder@siafi.lidera.srv.br
MAIL_PASS=Siafi@1234
SMTP_FROM="SIAFI — Lidera" <nao-responder@siafi.lidera.srv.br>

# Redis (Upstash)
REDIS_HOST=credible-ostrich-132296.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD="..."
REDIS_TLS=true

# Mercado Pago
MP_ACCESS_TOKEN="..."
MP_PUBLIC_KEY="..."
MP_WEBHOOK_SECRET="..."

# WhatsApp (Evolution API)
WHATSAPP_API_URL=http://localhost:8080
WHATSAPP_API_KEY="..."
WHATSAPP_INSTANCE=lidera
WHATSAPP_SUPORTE=(65) 99999-9999
```

---

## Build e Deploy

```bash
# Verificar tipos (sem emitir)
npx tsc --noEmit

# Build de produção
npm run build
# Saída: dist/src/main.js

# Restart do serviço Windows
sc.exe stop SIAFI-API && sleep 2 && sc.exe start SIAFI-API

# Migrações (sempre antes do restart)
sc.exe stop SIAFI-API
npx prisma migrate deploy
sc.exe start SIAFI-API
```
