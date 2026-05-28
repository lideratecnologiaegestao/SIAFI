# SIAFI 2.0 — Guia do Backend (NestJS)
> Última atualização: 2026-05-23 | NestJS 10 · TypeScript 5 · Prisma 5

---

## 1. Estrutura de Módulos

```
backend/src/
├── main.ts
├── app.module.ts
├── common/
│   ├── decorators/        ← @Roles(), @CurrentUser(), @Public()
│   ├── guards/            ← JwtAuthGuard, RolesGuard
│   ├── interceptors/      ← AuditInterceptor
│   └── helpers/           ← safeDecimal(), calcularEncargos(), generateHash()
└── modules/
    ├── auth/              ← Login, refresh, logout, me, MFA
    ├── users/             ← CRUD operadores
    ├── clients/           ← CRUD clientes + upload documentos
    ├── loans/             ← Contratos + geração de parcelas + split decimal.js
    ├── installments/      ← Parcelas + markOverdue + pagamento parcial
    ├── payments/          ← Pagamentos + estorno + recálculo de encargos
    ├── transactions/      ← Caixa (saldo + movimentação + lançamentos)
    ├── renegociacoes/     ← Renegociação de dívidas
    ├── pix/               ← Geração QR Code Mercado Pago
    ├── webhook/           ← Confirmação de pagamento Mercado Pago
    ├── notifications/     ← Log de notificações enviadas
    ├── reports/           ← Relatórios (carteira, faturamento, aging, movimentação, contratos)
    ├── audit/             ← Log de auditoria imutável
    ├── settings/          ← Parâmetros globais do sistema
    ├── client-portal/     ← Portal do cliente (role=cliente)
    ├── score-risco/       ← Score ponderado de crédito interno
    ├── intencao/          ← Intenções de empréstimo + SLA + ativação de portal
    ├── reparcelamento/    ← Fluxo completo: solicitação → proposta → aprovação → execução
    ├── mensagem/          ← Chat interno + Supabase Realtime
    ├── email/             ← Templates editáveis + dispatch BullMQ
    ├── cobranca/          ← Cobrança antecipada + reenvio automático
    └── consultor/         ← Carteira, solicitações, cobranças filtradas por consultorId
```

---

## 2. Padrão de Controller

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('endpoint')
export class MeuController {
  // Rotas estáticas SEMPRE antes de /:id
  @Get('stats') @Roles('admin', 'financeiro')
  getStats() { ... }

  @Get(':id') @Roles('admin', 'financeiro')
  findOne(@Param('id') id: string) { ... }
}
```

> Rotas estáticas (`/badge`, `/stats`, `/simular`, `/overdue`) devem ser declaradas antes de `/:id` no controller para evitar conflito de roteamento no NestJS.

---

## 3. Módulo Auth

**Endpoint base:** `/api/auth` | **Roles:** público (exceto `/me`)

Fluxo: `POST /login` → Supabase `signInWithPassword()` → valida `role` no banco local → emite JWT com `{ sub, email, role }` + refresh token.

MFA via Supabase TOTP. Perfis `admin`/`financeiro`/`consultor` bloqueados imediatamente se não configurado. `caixa`/`cliente` têm prazo de 5 logins (`loginCount`).

---

## 4. Módulo Clients

**Endpoint base:** `/api/clients` | **Roles:** admin, financeiro, caixa

Upload via `multipart/form-data`: foto, RG e comprovante armazenados no bucket `client-documents` (Supabase Storage).

Soft-delete: campo `active: false` — o cliente desaparece de listagens mas dados e histórico são preservados.

---

## 5. Módulo Loans

**Endpoint base:** `/api/loans` | **Roles:** admin, financeiro

**Geração de parcelas:** ao criar um loan, o sistema gera `n` installments via `Decimal.js`:

```
installment_amount   = valor informado (invariante)
principal_payback    = principal_amount / numeroParcelas
net_gain             = installment_amount - principal_payback
total_receivable     = installment_amount × numeroParcelas
```

Campos `principal_payback` e `net_gain` **nunca** são retornados a perfis `caixa` ou `cliente`.

---

## 6. Módulo Installments

**Endpoint base:** `/api/installments` | **Roles:** admin, financeiro, caixa

Quando `valorPago < installment_amount`, a parcela fica com status `parcialmente_pago`. Os campos `saldoDevedor` e `moraAcumulada` são recalculados pelo cron `atualizarEncargos` a cada meia-noite.

---

## 7. Módulo Payments

**Endpoint base:** `/api/payments` | **Roles:** admin, financeiro, caixa

**Estorno:** `DELETE /:id/estornar` reverte o pagamento, recalcula saldo e mora da parcela.

Após qualquer pagamento ou estorno: `void scoreRisco.recalcularScore(clientId)` (fire-and-forget — nunca propaga erro).

---

## 8. Módulo IntencaoEmprestimo

**Endpoint base:** `/api/intencoes` | **Roles:** admin, financeiro, consultor

**Ciclo de status:**
`rascunho` → `pendente` → `em_analise` → `aprovada` | `rejeitada` | `expirada`

Cron `verificarSlaIntencoes` (a cada 2h) expira intenções com `prazoAnalise` vencido. Auto-aprovação configurável via `financeiro.auto_aprovacao` nas SiteSettings.

**Ativação de portal:** ao aprovar, se o cliente não tiver `supabaseId`, o sistema enfileira o job `activate-portal` no BullMQ — cria usuário Supabase e envia e-mail de boas-vindas.

---

## 9. Módulo Reparcelamento

**Endpoint base:** `/api/reparcelamentos` | **Roles:** admin, financeiro, consultor

**Fluxo de 4 etapas:**
1. **Solicitação** — consultor ou cliente via portal cria a solicitação
2. **Proposta** — financeiro define novos termos (`PATCH /:id/proposta`)
3. **2ª aprovação** — se acima do limite configurável (`PATCH /:id/aprovar`)
4. **Execução atômica** — `PATCH /:id/executar` em `$transaction` Prisma:
   - Cancela loan original + parcelas não pagas
   - Cria novo loan com `origemLoanId` + `reparcelamentoCount + 1`
   - Gera `aceiteClienteHash` (SHA-256 do aceite digital)
   - Atualiza solicitação para `executado`
   - `void scoreRisco.recalcularScore(clientId)`

---

## 10. Módulo Consultor

**Endpoint base:** `/api/consultor` | **Roles:** consultor, admin, financeiro

Todos os endpoints filtram por `consultorId` extraído do JWT. Admin e financeiro passam `?consultorId=` opcional para ver qualquer carteira.

Registra `CobrancaContato` ao registrar tentativas de cobrança (canal, resultado, observações).

---

## 11. Módulo ScoreRisco

**Endpoint base:** `/api/score-risco` | **Roles:** admin, financeiro, consultor

**Ponderação:**

| Fator | Peso |
|-------|------|
| Pontualidade de pagamentos | 50% |
| Histórico de reparcelamentos | 30% |
| Contratos quitados com sucesso | 20% |

**Quando recalcular (sempre fire-and-forget — nunca propaga erro):**
- Após pagamento registrado
- Após estorno de pagamento
- Após `markOverdue`
- Após execução de reparcelamento

---

## 12. Módulo Mensagens

**Endpoint base:** `/api/mensagens` | **Roles:** admin, financeiro, consultor, caixa

Conversas diretas 1:1 entre operadores. Realtime via Supabase `postgres_changes` na tabela `mensagens` (evento INSERT).

`GET /badge` retorna `{ count: number }` — rota estática, declarada antes de `/:id`.

`ultimaLeitura` por participante é atualizada ao acessar `GET /conversas/:id`.

---

## 13. Módulo Email

**Roles:** sistema interno (sem endpoint público direto)

13 tipos de e-mail automático. Templates editáveis pelo admin armazenados no model `EmailTemplate`. Dispatch via job BullMQ `send-email` → Nodemailer → SMTP configurado em SiteSettings.

Variáveis de template: `{{nome_cliente}}`, `{{valor_parcela}}`, `{{data_vencimento}}`, `{{link_portal}}`, `{{link_aceite}}`, `{{nome_consultor}}`, entre outras.

---

## 14. Módulo Cobrança

**Roles:** sistema interno (sem endpoint público direto)

Cron `enviarCobrancasAntecipadas` envia notificação X dias antes do vencimento — valor configurável por contrato ou pelo padrão global em SiteSettings. Canais: WhatsApp (Evolution API), Email (SMTP), notificação interna do portal.

Cron `reenviarCobrancaNaoLida` verifica cobranças sem confirmação de leitura e reenvia às 14h.

---

## 15. Módulo PIX / Webhook

**PIX:** `/api/pix` (auth) | **Webhook:** `/api/webhook/mp` (público)

Geração: `POST /api/pix/generate` → Mercado Pago API → retorna `qr_code` + `qr_code_base64`. QR Code válido por 24h.

Webhook: `POST /api/webhook/mp` → valida assinatura MP → enfileira job `confirm-mp-payment` no `payment-queue`. Idempotente: verifica se o pagamento já foi registrado antes de processar.

---

## 16. Módulo Portal (Client Portal)

**Endpoint base:** `/api/portal` | **Roles:** cliente

Campos `principal_payback` e `net_gain` **nunca** retornados. O cliente vê apenas `installment_amount`, `saldoDevedor` e `status`.

RLS Supabase garante isolamento a nível de banco — o cliente acessa somente dados com `client_id` vinculado ao seu `auth.uid()`.

---

## 17. Módulos de Suporte

| Módulo | Base | Roles | Descrição |
|--------|------|-------|-----------|
| Reports | `/api/reports` | admin, financeiro | Carteira, faturamento, clientes, movimentação, contratos |
| Audit | `/api/audit` | admin | Log imutável de todas as mutações |
| Settings | `/api/settings` | admin | Parâmetros globais e integrações |
| Notifications | `/api/notifications` | admin, financeiro | Log de notificações enviadas |
| Transactions | `/api/transactions` | admin, financeiro, caixa | Saldo e movimentações do caixa |
| Renegociacoes | `/api/renegociacoes` | admin, financeiro | Renegociações de dívidas |
| Support | `/api/support` | todos | Tickets de suporte |

---

## 18. Guards e Decorators

```typescript
@UseGuards(JwtAuthGuard, RolesGuard) // aplicar no controller ou no método
@Roles('admin', 'financeiro')        // roles permitidas
@CurrentUser() user: AuthUser        // injetar usuário autenticado
@Public()                            // bypassar guards (login, webhook)
```

`JwtAuthGuard` valida assinatura do JWT local. `RolesGuard` lê o campo `role` do payload e compara com `@Roles()`. `@Public()` é usado em `/api/auth/login` e `/api/webhook/mp`.

---

## 19. AuditInterceptor

Intercepta todas as mutações (POST, PATCH, DELETE) e persiste no model `AuditLog`:

| Campo | Valor |
|-------|-------|
| `userId` | ID do operador autenticado |
| `action` | Método HTTP + rota normalizada |
| `entity` | Entidade afetada (derivada da rota) |
| `entityId` | ID do recurso afetado (quando disponível) |
| `before` | Snapshot antes da mutação |
| `after` | Snapshot após a mutação |
| `ip` | IP do cliente |
| `createdAt` | Timestamp imutável |

O model `AuditLog` não possui endpoint de DELETE — imutável por design.

---

## 20. Helpers e Utilitários

| Helper | Localização | Uso |
|--------|-------------|-----|
| `safeDecimal(value)` | `common/helpers/decimal.ts` | Converte para `Decimal` com segurança — usar em todos os cálculos financeiros |
| `calcularEncargos(installment, date)` | `common/helpers/encargos.ts` | Calcula multa + mora acumulada até `date` |
| `formatCurrency(value)` | `common/helpers/format.ts` | Formata `Decimal` como moeda BRL |
| `generateHash(data)` | `common/helpers/crypto.ts` | SHA-256 para `aceiteClienteHash` |

---

## APÊNDICE — Todos os Endpoints da API

### Auth `/api/auth`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| POST | /login | público | Login com e-mail e senha |
| POST | /refresh | público | Renovar access token |
| POST | /logout | autenticado | Encerrar sessão |
| GET | /me | autenticado | Dados do usuário atual |

### Users `/api/users`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin | Listar operadores |
| POST | / | admin | Criar operador |
| PATCH | /:id | admin | Atualizar operador |
| DELETE | /:id | admin | Desativar operador |

### Clients `/api/clients`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro, caixa | Listar clientes (paginado, search, status) |
| GET | /stats | admin, financeiro | Totais por status |
| GET | /quitados | admin, financeiro | Lista de clientes quitados |
| GET | /:id | admin, financeiro, caixa | Detalhe com loans[] |
| POST | / | admin, financeiro | Criar cliente (multipart/form-data) |
| PATCH | /:id | admin, financeiro | Atualizar cliente |
| DELETE | /:id | admin, financeiro | Soft-delete |
| POST | /:id/ativar-portal | admin, financeiro | Ativar acesso ao portal |
| POST | /:id/desativar-portal | admin, financeiro | Desativar acesso ao portal |

### Loans `/api/loans`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro | Listar contratos (search, status, clientId, page, limit) |
| GET | /stats | admin, financeiro | Totais e valores globais |
| GET | /:id | admin, financeiro, caixa | Detalhe com installments[] e client |
| POST | / | admin, financeiro | Criar contrato + gerar parcelas automaticamente |
| PATCH | /:id/cancel | admin, financeiro | Cancelar contrato |
| PATCH | /:id/liberar-capital | caixa, financeiro, admin | Confirmar entrega do capital |

### Installments `/api/installments`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /overdue | admin, financeiro, caixa | Parcelas em atraso |
| GET | /:id | admin, financeiro, caixa | Detalhe da parcela com encargos calculados |
| POST | /mark-overdue | sistema (cron) | Marca parcelas vencidas |

### Payments `/api/payments`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro, caixa | Histórico de pagamentos |
| POST | / | admin, financeiro, caixa | Registrar pagamento |
| DELETE | /:id/estornar | admin, financeiro | Estornar pagamento |

### Transactions `/api/transactions`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro, caixa | Listar transações |
| GET | /saldo | admin, financeiro, caixa | Saldo atual do caixa |
| GET | /movimento | admin, financeiro, caixa | Movimentação por período |
| POST | / | admin, financeiro, caixa | Lançamento manual |

### Renegociacoes `/api/renegociacoes`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro | Listar (filtro por loanId) |
| POST | / | admin, financeiro | Criar renegociação |

### PIX `/api/pix`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /:installmentId | admin, financeiro, consultor | Consultar QR Code existente |
| POST | /generate | admin, financeiro, consultor | Gerar novo QR Code PIX |

### Webhook `/api/webhook`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| POST | /mp | público | Receber confirmação de pagamento do Mercado Pago |

### Notifications `/api/notifications`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro | Log de notificações enviadas |

### Reports `/api/reports`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /carteira | admin, financeiro | Resumo da carteira (capital, a receber, em risco) |
| GET | /clientes | admin, financeiro | Lista clientes ativos com próxima parcela |
| GET | /movimentacao | admin, financeiro | Movimentação por período (startDate, endDate) |
| GET | /contratos | admin, financeiro | Contratos por status |
| GET | /faturamento | admin, financeiro | Faturamento mensal por consultor (mes=YYYY-MM) |

### Audit `/api/audit`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin | Log de auditoria (filtros: userId, action, entity, startDate, endDate) |

### Settings `/api/settings`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin | Listar todos os parâmetros |
| PATCH | / | admin | Atualizar parâmetros |

### Client Portal `/api/portal`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /me | cliente | Dados do cliente autenticado |
| GET | /loans | cliente | Contratos do cliente (sem split interno) |
| GET | /installments | cliente | Parcelas com saldoDevedor e mora |
| POST | /tickets | cliente | Abrir chamado de suporte |
| GET | /tickets | cliente | Listar chamados do cliente |
| POST | /reparcelamentos | cliente | Solicitar reparcelamento |

### Score Risco `/api/score-risco`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /:clientId | admin, financeiro, consultor | Score atual do cliente |
| POST | /recalcular/:clientId | admin, financeiro | Recalcular score manualmente |

### Intencoes `/api/intencoes`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro, consultor | Listar intenções (filtro por status, consultorId) |
| GET | /:id | admin, financeiro, consultor | Detalhe da intenção |
| POST | / | admin, financeiro, consultor | Criar intenção |
| PATCH | /:id/aprovar | admin, financeiro | Aprovar com termos finais do contrato |
| PATCH | /:id/rejeitar | admin, financeiro | Rejeitar com motivo |
| PATCH | /:id/feedback | consultor | Registrar feedback pós-decisão |

### Reparcelamentos `/api/reparcelamentos`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | / | admin, financeiro, consultor | Listar solicitações (filtro por status, clientId, loanId) |
| GET | /:id | admin, financeiro, consultor | Detalhe da solicitação |
| POST | / | admin, financeiro, consultor | Criar solicitação |
| POST | /simular | admin, financeiro | Simulação de novos termos sem gravar |
| PATCH | /:id/proposta | admin, financeiro | Enviar proposta de novos termos |
| PATCH | /:id/aprovar | admin, financeiro | 2ª instância de aprovação |
| PATCH | /:id/rejeitar | admin, financeiro, consultor | Rejeitar em qualquer etapa |
| PATCH | /:id/executar | admin, financeiro | Executar reparcelamento atomicamente |

### Mensagens `/api/mensagens`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /badge | todos (exceto cliente) | Contagem de mensagens não lidas |
| GET | /conversas | todos (exceto cliente) | Lista de conversas com naoLidas por conversa |
| GET | /conversas/:id | todos (exceto cliente) | Mensagens da conversa + marca ultimaLeitura |
| POST | /conversas | todos (exceto cliente) | Criar conversa direta (idempotente) |
| POST | /conversas/:id | todos (exceto cliente) | Enviar mensagem |

### Consultor `/api/consultor`

| Método | Rota | Roles | Descrição |
|--------|------|-------|-----------|
| GET | /carteira | consultor, admin, financeiro | Clientes da carteira (filtrado por consultorId) |
| GET | /carteira/:clientId | consultor, admin, financeiro | Detalhe do cliente na carteira |
| GET | /solicitacoes | consultor, admin, financeiro | Solicitações ao financeiro |
| GET | /cobrancas | consultor, admin, financeiro | Parcelas atrasadas da carteira |
| POST | /cobrancas/:installmentId/contato | consultor | Registrar tentativa de cobrança |

---

*Última atualização: 2026-05-23 | Mantido por: equipe SIAFI*
