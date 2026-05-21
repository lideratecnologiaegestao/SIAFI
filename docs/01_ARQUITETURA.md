# SIAFI 2.0 — Arquitetura do Sistema

> Última atualização: 2026-05-22 | Versão: 2.0

---

## Decisão: Monolito Modular vs Microsserviços

**Escolha: Monolito Modular (NestJS)**

Razões:
- Equipe pequena — overhead de orquestração de microsserviços não se justifica
- Deploy simples via NSSM no Windows Server existente
- Módulos isolados por domínio facilitam extração futura se necessário
- Transações atômicas entre módulos (ex: execução de reparcelamento) sem XA-transactions

---

## Diagrama Geral

```
┌─────────────────────────────────────────────────────────────┐
│                      Internet / Clientes                     │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS :443
                    ┌────────▼────────┐
                    │   Nginx 1.28.0  │  SSL Let's Encrypt
                    │  reverse proxy  │  financeiro.lidera.app.br
                    └──┬──────────┬───┘
             /api/*    │          │   /*
     ┌────────────────▼──┐   ┌───▼─────────────────┐
     │  NestJS Backend   │   │  Next.js 16 Frontend │
     │    :4010          │   │    :4011             │
     │  24 módulos       │   │  35+ páginas         │
     └─────┬──────┬──────┘   └─────────────────────┘
           │      │
     ┌─────▼──┐ ┌─▼──────────────────────────┐
     │ Redis  │ │        Supabase Cloud       │
     │ BullMQ │ │  sa-east-1 (São Paulo)     │
     │Upstash │ │  ├─ PostgreSQL 15          │
     └────────┘ │  ├─ Auth (GoTrue)          │
                │  ├─ Storage                │
                │  └─ Realtime               │
                └────────────────────────────┘
```

---

## Fluxo de Requisição

```
Browser → Nginx (SSL termination + proxy_pass)
              ↓
         NestJS :4010
              ↓
         GlobalExceptionFilter  (erros padronizados)
              ↓
         JwtAuthGuard           (valida Bearer JWT local)
              ↓
         RolesGuard             (verifica @Roles() decorator)
              ↓
         ValidationPipe         (class-validator DTOs)
              ↓
         Controller → Service → Prisma → PostgreSQL
              ↓ (opcional)
         BullMQ Queue → Worker  (emails, WhatsApp, PIX)
```

---

## Autenticação

### Operadores Internos

```
POST /api/auth/login
  1. Busca user por username OU email (Prisma)
  2. Verifica bloqueio (>5 falhas → lock 15min)
  3. Valida senha bcrypt (rounds=12)
  4. signInWithPassword Supabase GoTrue (email sintético: username@siafi.internal)
  5. Emite JWT local (15min) + Refresh Token (7d) assinados com JWT_SECRET local
  6. Retorna { accessToken, refreshToken, user }

Refresh automático: frontend chama POST /api/auth/refresh a cada 14min
```

### Clientes do Portal

```
POST /api/auth/login (email real)
  1. Supabase GoTrue verifica credenciais
  2. app_metadata.role = 'cliente' identifica o tipo
  3. JWT local emitido com role='cliente'
  4. Acesso restrito a /api/portal/*
```

### MFA (TOTP)

- Operadores: configurável via `/mfa-setup` (TOTP — Google Authenticator/Authy)
- Clientes: 5 logins sem MFA → bloqueio preventivo com aviso
- Supabase MFA API (AAL2)

---

## Roles e Permissões

| Role | Acesso |
|------|--------|
| `admin` | Tudo + configurações, auditoria, usuários |
| `financeiro` | Clientes, empréstimos, pagamentos, relatórios, reparcelamentos, intenções |
| `caixa` | Caixa, pagamentos, visualização de clientes/parcelas |
| `consultor` | Carteira própria, intenções, reparcelamentos, chat |
| `cliente` | Portal próprio — somente dados pessoais |

---

## Módulos Backend (24)

```
src/modules/
├── auth/           → Login, MFA, refresh, logout, /me, Google OAuth
├── users/          → CRUD operadores com roles
├── clients/        → CRUD clientes, upload docs S3, vincular consultor
├── loans/          → Contratos, parcelas, aceite digital, liberação capital
├── installments/   → Parcelas, markOverdue, split, pagamento parcial, mora
├── payments/       → Registro e estorno, fire-and-forget score pós-pagamento
├── transactions/   → Lançamentos manuais de caixa (entrada/saída)
├── pix/            → Geração QR Code PIX via Mercado Pago
├── webhook/        → Callbacks MP processados por PaymentWorker
├── renegociacoes/  → Renegociação simples de dívidas
├── reparcelamento/ → Fluxo: solicitação→proposta→aprovação→execução atômica
├── intencao/       → Intenções de empréstimo: SLA, auto-aprovação, score
├── score-risco/    → Score ponderado: pontualidade 50% / reparc. 30% / quit. 20%
├── consultor/      → Carteira, solicitações, cobranças do consultor
├── mensagem/       → Chat interno com Supabase Realtime (INSERT trigger)
├── cobranca/       → Cobrança antecipada: PDF boleto + multi-canal
├── notifications/  → Workers BullMQ: EmailWorker + WhatsappWorker
├── reports/        → Carteira, faturamento, clientes, movimentação, contratos
├── client-portal/  → Portal cliente: home, parcelas, PIX, suporte, perfil
├── cron/           → 10 jobs agendados (America/Sao_Paulo)
├── audit/          → AuditLog com filtro por ação e entidade
├── settings/       → Parâmetros configuráveis (SiteSetting)
├── pdf/            → Geração de PDF via PDFKit (bufferizado)
└── queue/          → Constantes, interfaces e registro BullMQ
```

---

## Filas BullMQ

### `finance-notifications` (concurrency=3)

| Job | Trigger |
|-----|---------|
| `whatsapp.lembrete` | Cron 09h |
| `whatsapp.overdue` | Cron 10h |
| `whatsapp.portal-ativado` | Ativação/reenvio portal |
| `whatsapp.cobranca-antecipada` | Cron 09h30 |
| `email.lembrete` | Cron 09h |
| `email.confirmacao` | Pós-pagamento |
| `email.portal-ativado` | Ativação/reenvio portal |
| `email.cobranca-antecipada` | Cron 09h30 (PDF em anexo) |

### `payment-processing` (concurrency=1)

| Job | Trigger |
|-----|---------|
| `payment.process` | Webhook Mercado Pago |

**Retry:** 3 tentativas, backoff exponencial (1s → 2s → 4s).  
**Falha definitiva:** gravada em `audit_log` com ação `EMAIL_FALHOU` ou `WHATSAPP_FALHOU`.

---

## Crons (10 jobs — America/Sao_Paulo)

| Horário | Nome | Função |
|---------|------|--------|
| 02h00 | `conciliacao-pix` | Verifica PIX pendentes no MP |
| 07h00 | `sla-aceite` | Alerta D-2 (cliente) / D-1 (consultor); cancela vencidos |
| 08h00 | `mark-overdue` | Marca parcelas vencidas → `atrasado` |
| 08h05 | `atualizar-encargos` | Multa (uma vez) + mora diária sobre saldo devedor |
| 09h00 | `send-reminders` | Lembretes de vencimento próximo |
| 09h30 | `cobrancas-antecipadas` | PDF boleto + notificação antecipada |
| 10h00 | `send-overdue` | Notifica inadimplentes |
| 11h00 | `lembrete-reparcelamentos` | Cobranças pendentes de reparcelamento |
| 14h00 | `reenviar-cobrancas` | Reenvio de cobranças não lidas no portal |
| */2h | `sla-intencoes` | Verifica SLAs de intenções vencendo |

---

## Supabase

### PostgreSQL
- **Runtime (Prisma):** Transaction Pooler :6543 (pgBouncer) — evita esgotamento de conexões
- **Migrações DDL:** Direct connection :5432
- **Região:** sa-east-1 São Paulo — dados no Brasil ✅

### Auth (GoTrue)
- `email_confirm: true` → contas ativas imediatamente (sem verificação por email)
- Tokens expiram em 3600s; refresh via `/api/auth/refresh`

### Storage
- `client-documents`: documentos dos clientes (fotos, RG, comprovante)
- `boletos-cobranca`: PDFs de cobrança gerados pelo `CobrancaService`
- URLs assinadas (TTL 1h), renovadas automaticamente pelo frontend

### Realtime
- Publication `supabase_realtime` na tabela `mensagens`
- Frontend assina `postgres_changes` type INSERT filtrado por `conversa_id`
- Badge não-lidas: polling 30s + evento Realtime (redundante por confiabilidade)

---

## Email (Hostinger SMTP)

| Parâmetro | Valor |
|-----------|-------|
| Remetente | `nao-responder@siafi.lidera.srv.br` |
| Display name | `SIAFI — Lidera` |
| SMTP host | `smtp.hostinger.com:465` (SSL/TLS) |
| IMAP host | `imap.hostinger.com:993` (SSL) |
| Env vars | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `SMTP_FROM` |

Todos os envios passam pelo `EmailWorker` (BullMQ). Resultado registrado em `audit_log`:
- `EMAIL_ENVIADO` — inclui destinatário, assunto, messageId SMTP
- `EMAIL_FALHOU` — inclui erro SMTP exato
- `EMAIL_IGNORADO` — cliente sem email cadastrado

---

## Segurança

| Camada | Implementação |
|--------|--------------|
| HTTPS | Nginx + Let's Encrypt (HSTS 1 ano) |
| Autenticação | JWT Bearer obrigatório em todos os endpoints |
| Autorização | `@Roles()` + `RolesGuard` por endpoint |
| RLS | Supabase Row Level Security para clientes do portal |
| Validação | `class-validator` + `ValidationPipe(whitelist:true)` |
| Rate limit | 100 req/min global; 10 req/min em `/auth/login` |
| Bloqueio conta | 5 falhas consecutivas → lock 15min |
| Headers | Helmet.js (X-Frame, CSP, HSTS, X-Content-Type) |
| CORS | Whitelist explícita de origens |
| Upload | memoryStorage, sem escrita em disco, mimetype validado |
| SQL injection | Prisma ORM (queries parametrizadas) |
| XSS | Next.js escapa por padrão; sem `dangerouslySetInnerHTML` |
| Senhas | bcrypt rounds=12 para operadores; Supabase Auth para clientes |
| Secrets | `.env` servidor, nunca no bundle frontend |

---

## Conformidade LGPD

### Bases Legais (Art. 7º LGPD)
- **Execução de contrato** (V): dados de crédito, CPF, histórico financeiro
- **Legítimo interesse** (IX): prevenção a fraude, score de risco
- **Consentimento** (I): notificações por email (`notificacoesEmail`)

### Direitos do Titular

| Direito | Implementação |
|---------|--------------|
| Acesso | Portal do cliente — contratos, parcelas, histórico |
| Correção | Via operador (admin/financeiro) |
| Exclusão | Soft-delete; dados financeiros retidos 5 anos (lei) |
| Informação | Portal mostra dados pessoais do perfil |
| Revogação de consentimento | Campo `notificacoesEmail` editável |

### Retenção
- Dados financeiros (contratos, pagamentos): **mínimo 5 anos** — obrigação Receita Federal / CFC
- Logs de auditoria: **permanente**
- Documentos pessoais: enquanto ativo; excluídos sob solicitação após quitação

### Localização
Dados processados e armazenados exclusivamente em `sa-east-1` (São Paulo) — **sem transferência internacional**.

### Gaps Identificados (roadmap compliance)
- [ ] Política de Privacidade publicada no portal
- [ ] Termo de Consentimento LGPD no cadastro do cliente
- [ ] Fluxo UI para `DataDeletionRequest` (modelo existe, interface pendente)
- [ ] DPO formalmente designado
- [ ] RIPD (Relatório de Impacto à Proteção de Dados) elaborado
- [ ] Registro de Operações de Tratamento (Art. 37 LGPD)

---

## Infraestrutura de Produção

```
Windows Server 2022 Standard (D:\LIDERA\SIAFI\)
├── Nginx 1.28.0
│   └── /etc/nginx/sites-available/siafi (reverse proxy + SSL)
├── NSSM Services
│   ├── SIAFI-API   → node dist/src/main.js  (:4010)  [Automático]
│   └── SIAFI-WEB   → next start             (:4011)  [Automático]
└── SSL: Let's Encrypt (Certbot)
    └── financeiro.lidera.app.br
```

### Deploy

```bash
# Backend
cd /d/LIDERA/SIAFI/backend
npm run build
sc.exe stop SIAFI-API && sleep 2 && sc.exe start SIAFI-API

# Frontend
cd /d/LIDERA/SIAFI/frontend
npm run build
sc.exe stop SIAFI-WEB && sleep 3 && sc.exe start SIAFI-WEB

# Migrações (antes do deploy)
npx prisma migrate deploy
```
