# SIAFI 2.0 — Guia do Backend (NestJS)

## Estrutura de Módulos

```
backend/src/
├── main.ts                    Bootstrap (CORS, cookies, class-validator, prefix /api)
├── app.module.ts              Módulo raiz (16 módulos importados)
├── prisma/
│   ├── prisma.module.ts       @Global() — disponível em todos os módulos
│   └── prisma.service.ts      Instância do PrismaClient
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts   @CurrentUser() extrai user do JWT
│   │   └── roles.decorator.ts          @Roles('admin', 'financeiro')
│   ├── guards/
│   │   └── roles.guard.ts              Verifica role do JWT contra @Roles()
│   └── dto/
│       └── paginated-response.dto.ts   { data, total, page, lastPage }
└── modules/
    ├── auth/           Login, JWT, refresh token, logout
    ├── users/          CRUD operadores com bcrypt
    ├── clients/        CRUD clientes + upload (multer) + stats ampliados
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

### Fluxo JWT

```
POST /api/auth/login
  → valida username + password (bcrypt)
  → retorna accessToken (15min, no body)
  → seta refreshToken (7d, httpOnly cookie SHA-256 no DB)

GET /api/auth/me
  → Bearer {accessToken} no header Authorization
  → retorna { id, nome, username, role }

POST /api/auth/refresh
  → lê cookie refreshToken
  → valida hash no DB → emite novo accessToken

POST /api/auth/logout
  → remove refreshToken do DB + limpa cookie
```

### Guards

```typescript
// Em qualquer controller protegido
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('resource')
export class ResourceController {
  @Get()
  @Roles('admin', 'financeiro')  // RolesGuard verifica user.role
  findAll() { ... }

  @Get(':id')
  @Roles('admin', 'financeiro', 'caixa')
  findOne(@Param('id', ParseIntPipe) id: number) { ... }
}
```

---

## Módulo Clients — Endpoints Completos

```
GET    /api/clients              ?search=&status=active|inactive&page=&limit=
GET    /api/clients/stats        → { total, ativos, inativos, quitados, atrasados }
GET    /api/clients/quitados     → [{ id, nome, cpf }]
GET    /api/clients/:id          → Client com loans[]
POST   /api/clients              multipart/form-data (foto, rg, comprovante)
PATCH  /api/clients/:id          multipart/form-data
DELETE /api/clients/:id          soft-delete (active: false)
```

**Stats retornados por /clients/stats:**
- `total`: todos os clientes
- `ativos`: clientes com `active: true`
- `inativos`: clientes com `active: false`
- `quitados`: clientes com pelo menos 1 empréstimo `status: quitado`
- `atrasados`: clientes com pelo menos 1 parcela `status: atrasado`

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
GET    /api/payments              ?installmentId=&page=
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
  "valorInvestido": 15000.00,      // Soma de valorInvestido (ou valor) dos empréstimos ativos
  "valorTotalParcelado": 18500.00, // Soma de todas as parcelas dos empréstimos ativos
  "valorRecebido": 6200.00,        // Total recebido em pagamentos (geral)
  "aReceber": 12300.00,            // Soma de parcelas pendentes + atrasadas
  "totalAtivos": 12,               // Quantidade de empréstimos ativos
  "totalAtrasados": 3              // Quantidade de empréstimos com parcela atrasada
}
```

---

## Cron Jobs

| Job | Horário | Função |
|-----|---------|--------|
| markOverdue | Diário 08:00 | Marca parcelas vencidas como `atrasado` |
| sendReminders | Diário 09:00 | Envia lembretes de parcelas próximas |
| sendOverdueNotices | Diário 10:00 | Envia cobranças de parcelas atrasadas |

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

// 3. Registrar serviço (sem necessidade de Repository — usa PrismaService diretamente)
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

## Banco de Dados

| Tabela | Model | Descrição |
|--------|-------|-----------|
| users | User | Operadores do sistema (bcrypt) |
| clients | Client | Clientes com soft-delete |
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
| refresh_tokens | RefreshToken | Tokens de refresh (hash SHA-256) |

Schema completo: `backend/prisma/schema.prisma`

---

## Build e Deploy

```powershell
cd D:\LIDERA\SIAFI\backend

# Compilar TypeScript → dist/
npm run build

# Gerar/aplicar migrações
npx prisma migrate deploy

# Gerar client Prisma (após alterar schema)
npx prisma generate

# Verificar se compila sem erros
npm run build; echo "Exit: $LASTEXITCODE"
```

---

*Última atualização: 2026-05-19*
