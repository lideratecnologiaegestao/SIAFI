# SIAFI 2.0 — Guia do Backend (NestJS)

## Estrutura de Módulos

```
backend/src/
├── main.ts                    Bootstrap (CORS, cookies, class-validator, prefix /api)
├── app.module.ts              Módulo raiz (16 módulos importados)
├── prisma/
│   ├── prisma.module.ts       @Global() — disponível em todos os módulos
│   └── prisma.service.ts      Instância do PrismaClient
├── supabase/
│   ├── supabase.module.ts     @Global() — SupabaseService disponível em todos os módulos
│   └── supabase.service.ts    createClient() com service_role key (Auth Admin + Storage)
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   @CurrentUser() extrai user do JWT Supabase
│   │   └── roles.decorator.ts          @Roles('admin', 'financeiro')
│   ├── guards/
│   │   └── roles.guard.ts              Verifica app_metadata.role do JWT contra @Roles()
│   └── dto/
│       └── paginated-response.dto.ts   { data, total, page, lastPage }
└── modules/
    ├── auth/           Login Supabase, refresh, logout, MFA, createOperator
    ├── users/          CRUD operadores com bcrypt + sync supabaseId
    ├── clients/        CRUD clientes + upload Supabase Storage + stats
    ├── loans/          Empréstimos + parcelas automáticas + valorParcela direto
    ├── installments/   Parcelas + overdue
    ├── payments/       Pagamentos + estorno + transaction automática
    ├── transactions/   Caixa (entradas/saídas)
    ├── renegociacoes/  Renegociação de dívidas
    ├── pix/            QR Code Mercado Pago
    ├── webhook/        Webhook MP com validação HMAC
    ├── notifications/  Log de notificações WhatsApp/Email
    ├── cron/           Jobs automáticos (markOverdue, envio lembretes)
    ├── reports/        Relatórios gerenciais
    ├── audit/          Log de auditoria
    ├── settings/       Configurações dinâmicas (site_settings)
    └── client-portal/  API exclusiva para clientes (/api/portal)
```

---

## Autenticação

### Fluxo Supabase GoTrue

```
POST /api/auth/login
  → valida username + password (bcrypt) localmente
  → auto-sync usuário para Supabase Auth se supabaseId == null
  → signInWithPassword no Supabase (email = username@siafi.local)
  → retorna { accessToken (JWT Supabase), user: { id, nome, role } }
  → seta refreshToken Supabase em httpOnly cookie (7d)

GET /api/auth/me
  → Bearer {accessToken} no header Authorization
  → JwtAuthGuard valida com SUPABASE_JWT_SECRET
  → retorna { id, nome, username, role }

POST /api/auth/refresh
  → lê cookie refresh_token
  → Supabase refreshSession() → novo access_token

POST /api/auth/logout
  → Supabase Auth admin.signOut(supabaseId, 'local')
  → limpa cookie

POST /api/auth/mfa/challenge
  → { factorId, code } → Supabase MFA verify
  → eleva AAL para aal2 → retorna novo accessToken
```

### JwtAuthGuard

O `JwtAuthGuard` valida o JWT do Supabase (algoritmo HS256, secret = `SUPABASE_JWT_SECRET`).
Extrai do payload:
- `sub` → supabaseId
- `app_metadata.role` → role do operador
- `app_metadata.prismaId` → id na tabela users

### Guards

```typescript
// Em qualquer controller protegido
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resource')
export class ResourceController {
  @Get()
  @Roles('admin', 'financeiro')
  findAll() { ... }

  @Get(':id')
  @Roles('admin', 'financeiro', 'caixa')
  findOne(@Param('id', ParseIntPipe) id: number) { ... }
}
```

---

## SupabaseService

```typescript
// Disponível via injeção em qualquer módulo (@Global)
class SupabaseService {
  admin: SupabaseClient  // criado com service_role key

  // Upload de arquivo para bucket 'client-documents'
  async uploadFile(bucket: string, path: string, buffer: Buffer, mimetype: string): Promise<string>
  // path retornado: '{clientId}/tipo_timestamp.ext'

  // URL assinada para download (1 hora)
  async createSignedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string>
}
```

---

## Módulo Clients — Endpoints Completos

```
GET    /api/clients              ?search=&status=active|inactive&page=&limit=
GET    /api/clients/stats        → { total, ativos, inativos, quitados, atrasados }
GET    /api/clients/quitados     → [{ id, nome, cpf }]
GET    /api/clients/:id          → Client com loans[]
GET    /api/clients/:id/document-urls → { fotoUrl, rgUrl, comprovanteUrl } (URLs assinadas 1h)
POST   /api/clients              multipart/form-data (foto, rg, comprovante → Supabase Storage)
PATCH  /api/clients/:id          multipart/form-data
DELETE /api/clients/:id          soft-delete (active: false)
```

**Stats retornados por /clients/stats:**
- `total`: todos os clientes
- `ativos`: clientes com `active: true`
- `inativos`: clientes com `active: false`
- `quitados`: clientes com pelo menos 1 empréstimo `status: quitado`
- `atrasados`: clientes com pelo menos 1 parcela `status: atrasado`

**Upload de documentos (POST/PATCH):**
- Arquivos enviados como `multipart/form-data`
- Backend usa `SupabaseService.uploadFile()` para salvar no bucket `client-documents`
- Paths salvos no banco: `fotoPath`, `rgPath`, `comprovantePath`
- Para acessar: chamar `GET /api/clients/:id/document-urls` que retorna URLs assinadas (1h)

---

## Módulo Loans — Endpoints Completos

```
GET    /api/loans                ?search=&status=&clientId=&page=&limit=
GET    /api/loans/stats          → { totalAtivos, totalQuitados, valorEmCarteira, valorRecebidoMes }
GET    /api/loans/:id            → Loan com client + installments[]
POST   /api/loans                Cria empréstimo + gera parcelas automaticamente
PATCH  /api/loans/:id/cancel     Cancela empréstimo + parcelas pendentes/atrasadas
```

**Body de criação (POST /api/loans):**
```json
{
  "clientId": 1,
  "valor": 800,
  "valorInvestido": 700,
  "numeroParcelas": 5,
  "valorParcela": 280,
  "metodoPagamento": "cartao",
  "dataInicio": "2026-05-19",
  "observacoes": "Opcional"
}
```
- Se `valorParcela` for fornecido, usa diretamente (taxaJuros implícita calculada)
- Se `taxaJuros` for fornecido, calcula `valorParcela` pelo sistema price-simples
- Gera N installments automaticamente a partir de `dataInicio` (1 mês entre cada)

---

## Módulo Installments

```
GET  /api/installments/overdue    → parcelas com status=atrasado, include client
GET  /api/installments/:id        → parcela com loan + client + payments[]
POST /api/installments/mark-overdue → marca pendentes vencidas como atrasado (cron)
```

---

## Módulo Payments

```
GET    /api/payments              ?search= (filtra por nome do cliente) — retorna últimos 100
POST   /api/payments              Registra pagamento + atualiza totalPago + cria Transaction
DELETE /api/payments/:id/estornar Remove pagamento + recalcula totalPago + cria Transaction saída
```

**Comportamento do pagamento:**
- `totalPago` da parcela += valorPago
- Se `totalPago >= valor` da parcela: status = `pago`
- Se todas as parcelas do empréstimo estão pagas: loan.status = `quitado`
- Aceita valores maiores que o saldo da parcela (p.ex. multas incluídas)
- Cria Transaction automaticamente: `tipo=entrada, categoria="Pagamento de Parcela"`

---

## Módulo Reports — Carteira

```
GET /api/reports/carteira
```

Retorna:
```json
{
  "valorInvestido": 15000.00,
  "valorTotalParcelado": 18500.00,
  "valorRecebido": 6200.00,
  "aReceber": 12300.00,
  "totalAtivos": 12,
  "totalAtrasados": 3
}
```

---

## Cron Jobs

| Job | Horário | Função |
|-----|---------|--------|
| markOverdue | Diário 08:00 | Marca parcelas vencidas como `atrasado` |
| sendReminders | Diário 09:00 | Enfileira lembretes de parcelas próximas em `notif-queue` |
| sendOverdueNotices | Diário 10:00 | Enfileira cobranças de parcelas atrasadas em `notif-queue` |

Os jobs de envio não chamam Evolution API / SMTP diretamente — enfileiram no Redis via BullMQ para processamento assíncrono com retry.

---

## Filas Assíncronas (QueueModule / BullMQ)

```
backend/src/modules/queue/
├── queue.module.ts          Registra filas + BullBoard middleware
├── queue.constants.ts       QUEUE_FINANCE_NOTIFICATIONS, QUEUE_PAYMENT_PROCESSING
├── notification.processor.ts  Worker: WhatsApp (Evolution API) + E-mail (SMTP)
├── payment.processor.ts       Worker: confirmações de pagamento
└── admin-queue.middleware.ts  Autenticação da rota /admin/queues
```

| Fila | Constante | Tentativas | Backoff |
|------|-----------|-----------|---------|
| `notif-queue` | `QUEUE_FINANCE_NOTIFICATIONS` | 3x | 5s exponencial |
| `payment-queue` | `QUEUE_PAYMENT_PROCESSING` | 5x | 10s exponencial |

**Monitor:** BullBoard disponível em `/admin/queues` (rota protegida por middleware de autenticação).

**Injeção do producer:**
```typescript
@InjectQueue(QUEUE_FINANCE_NOTIFICATIONS)
private readonly notifQueue: Queue,

// Enfileirar job:
await this.notifQueue.add('send-whatsapp', { clientId, mensagem }, { attempts: 3 })
```

**Redis:** configurado via `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` no `.env`.
Para produção, usar Upstash com TLS habilitado.

---

## DTOs — Observações Importantes

### ValidationPipe global
Configurado com `whitelist: true, forbidNonWhitelisted: true, transform: true`.
Qualquer campo não declarado no DTO gera erro 400.

### UpdateClientDto
Escrito **sem** `PartialType` — todos os campos declarados explicitamente como opcionais.
Isso é necessário porque `PartialType` de `@nestjs/mapped-types` não registra corretamente
campos adicionados na subclasse no whitelist do class-validator.

### CPF/CNPJ
`@Transform(stripNonDigits)` aplicado no DTO antes da validação.
Regex: `^\d{11}$|^\d{14}$` — aceita CPF (11) ou CNPJ (14 dígitos).
Frontend envia formatado (`284.351.648-02`); backend strip antes de validar.

---

## Como Adicionar um Novo Módulo

```typescript
// 1. Criar módulo
@Module({
  controllers: [NovoController],
  providers: [NovoService],
  exports: [NovoService],
})
export class NovoModule {}

// 2. Importar em app.module.ts
imports: [...existingModules, NovoModule]

// 3. Registrar serviço
@Injectable()
export class NovoService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<unknown[]> {
    return this.prisma.novaEntidade.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
```

**Regra crítica:** rotas estáticas ANTES de rotas com parâmetros no controller:
```typescript
@Get('stats')  // DEVE VIR ANTES de @Get(':id')
getStats() { ... }

@Get(':id')
findOne() { ... }
```

---

## Banco de Dados — Tabelas Principais

| Tabela | Model | Descrição |
|--------|-------|-----------|
| users | User | Operadores (bcrypt + supabaseId) |
| clients | Client | Clientes com soft-delete; paths de documentos no Storage |
| loans | Loan | Contratos (valorInvestido, taxaJuros, modoTaxa) |
| installments | Installment | Parcelas geradas automaticamente |
| payments | Payment | Registros de pagamento |
| transactions | Transaction | Caixa (entrada/saída) |
| pix_payments | PixPayment | QR Codes gerados |
| renegociacoes | Renegociacao | Renegociações de dívida |
| notifications | Notification | Log de notificações |
| audit_logs | AuditLog | Histórico de ações |
| site_settings | SiteSetting | Configurações dinâmicas |
| support_tickets | SupportTicket | Tickets de suporte |

> **Nota:** Não há tabela `refresh_tokens` — sessões são gerenciadas pelo Supabase Auth (GoTrue).

Schema completo: `backend/prisma/schema.prisma`

---

## Build e Deploy

```powershell
cd D:\LIDERA\SIAFI\backend

# Compilar TypeScript → dist/
npm run build

# Aplicar migrações (usa DIRECT_URL :5432)
npx prisma migrate deploy

# Gerar client Prisma (após alterar schema)
npx prisma generate

# Verificar se compila sem erros
npm run build; echo "Exit: $LASTEXITCODE"
```

### Restart do serviço NSSM

```powershell
sc.exe stop SIAFI-API
# Se o processo ainda estiver vivo na porta 4010:
# netstat -ano | findstr :4010  → obter PID
# taskkill /PID <PID> /F
sc.exe start SIAFI-API
```

> **Atenção:** NSSM pode deixar o processo Node.js vivo (zombie) na porta 4010 após o stop.
> Verificar com `netstat` e fazer `taskkill /F` se necessário antes do start.
> Solução permanente: configurar `AppKillProcessTree = 1` no NSSM.

---

*Última atualização: 2026-05-20*
