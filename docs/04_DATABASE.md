# SIAFI 2.0 — Database (Prisma + PostgreSQL / Supabase)

> **Banco de dados:** PostgreSQL via Supabase Cloud (região sa-east-1)
> Projeto: `lvpseuaybpnmrneuyndi` · URL: `https://lvpseuaybpnmrneuyndi.supabase.co`
>
> **Sessões e tokens de autenticação** são gerenciados pelo Supabase Auth (GoTrue) —
> não há tabela `refresh_tokens` no schema Prisma.

## Convenções

- Nomes de tabelas: `snake_case` plural
- Nomes de campos: `snake_case`
- Prisma model names: `PascalCase` singular
- Soft delete via campo `active: Boolean` (não `deletedAt`)
- Timestamps automáticos: `createdAt`, `updatedAt`

## Conexão

```
DATABASE_URL  → Transaction Pooler :6543 (pgBouncer) — queries normais
DIRECT_URL    → Session Pooler :5432 — prisma migrate deploy
```

> **Windows Server:** IPv6 não suportado. Usar hostname do pooler
> (`aws-1-sa-east-1.pooler.supabase.com`), não a conexão direta `db.*.supabase.co`.

## Schema (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum UserRole {
  admin
  financeiro
  caixa
  usuario
  cliente
}

enum LoanStatus {
  ativo
  quitado
  cancelado
  inadimplente
}

enum InstallmentStatus {
  pendente
  pago
  atrasado
  cancelado
}

enum PaymentMethod {
  dinheiro
  pix
  mercadopago
  transferencia
  cheque
  cartao
}

model User {
  id          Int      @id @default(autoincrement())
  nome        String
  username    String   @unique
  password    String
  role        UserRole @default(usuario)
  active      Boolean  @default(true)
  supabaseId  String?  @unique @map("supabase_id")  // UUID do Supabase Auth
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  auditLogs    AuditLog[]
  transactions Transaction[]

  @@map("users")
}

// Não há model RefreshToken — sessões gerenciadas pelo Supabase Auth (GoTrue)

model Client {
  id              Int       @id @default(autoincrement())
  nome            String
  cpf             String?   @unique    // armazenado sem formatação (11 ou 14 dígitos)
  rg              String?
  dataNascimento  DateTime? @map("data_nascimento")
  email           String?
  whatsapp        String?
  telefone        String?
  endereco        String?
  bairro          String?
  cidade          String?
  estado          String?   @db.Char(2)
  cep             String?
  fotoPath        String?   @map("foto_path")         // path no Supabase Storage
  rgPath          String?   @map("rg_path")           // path no Supabase Storage
  comprovantePath String?   @map("comprovante_path")  // path no Supabase Storage
  active          Boolean   @default(true)
  notificacoesEmail Boolean @default(true) @map("notificacoes_email")
  observacoes     String?   @db.Text
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  loans         Loan[]
  pixPayments   PixPayment[]
  notifications Notification[]

  @@index([cpf])
  @@index([nome])
  @@map("clients")
}

model Loan {
  id             Int        @id @default(autoincrement())
  clientId       Int        @map("client_id")
  valor          Decimal    @db.Decimal(10, 2)
  valorInvestido Decimal?   @db.Decimal(10, 2) @map("valor_investido")
  taxaJuros      Decimal    @db.Decimal(5, 2) @map("taxa_juros")
  modoTaxa       String     @default("mensal") @map("modo_taxa")
  numeroParcelas Int        @map("numero_parcelas")
  dataInicio     DateTime   @map("data_inicio")
  status         LoanStatus @default(ativo)
  observacoes    String?    @db.Text
  createdAt      DateTime   @default(now()) @map("created_at")
  updatedAt      DateTime   @updatedAt @map("updated_at")

  client        Client         @relation(fields: [clientId], references: [id])
  installments  Installment[]
  renegociacoes Renegociacao[]
  mpPayments    MpPayment[]
  notifications Notification[]

  @@index([clientId])
  @@index([status])
  @@map("loans")
}

model Installment {
  id             Int               @id @default(autoincrement())
  loanId         Int               @map("loan_id")
  numero         Int
  valor          Decimal           @db.Decimal(10, 2)
  dataVencimento DateTime          @map("data_vencimento")
  status         InstallmentStatus @default(pendente)
  totalPago      Decimal           @default(0) @db.Decimal(10, 2) @map("total_pago")
  createdAt      DateTime          @default(now()) @map("created_at")
  updatedAt      DateTime          @updatedAt @map("updated_at")

  loan        Loan         @relation(fields: [loanId], references: [id])
  payments    Payment[]
  pixPayments PixPayment[]
  mpPayments  MpPayment[]

  @@index([loanId])
  @@index([status])
  @@index([dataVencimento])
  @@map("installments")
}

model Payment {
  id              Int           @id @default(autoincrement())
  installmentId   Int           @map("installment_id")
  valorPago       Decimal       @db.Decimal(10, 2) @map("valor_pago")
  dataPagamento   DateTime      @map("data_pagamento")
  metodoPagamento PaymentMethod @default(dinheiro) @map("metodo_pagamento")
  observacao      String?       @db.Text
  createdAt       DateTime      @default(now()) @map("created_at")

  installment Installment @relation(fields: [installmentId], references: [id])

  @@index([installmentId])
  @@index([dataPagamento])
  @@map("payments")
}

model Transaction {
  id        Int      @id @default(autoincrement())
  tipo      String   @db.VarChar(10)  // entrada | saida
  valor     Decimal  @db.Decimal(10, 2)
  descricao String?
  categoria String?
  data      DateTime
  userId    Int?     @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id])

  @@index([data])
  @@index([tipo])
  @@map("transactions")
}

model PixPayment {
  id            Int       @id @default(autoincrement())
  installmentId Int       @map("installment_id")
  clientId      Int       @map("client_id")
  paymentId     String?   @map("payment_id")
  qrCode        String?   @db.Text @map("qr_code")
  qrImage       String?   @db.Text @map("qr_image")
  amount        Decimal   @db.Decimal(10, 2)
  status        String    @default("pendente")
  sentWhatsapp  Boolean   @default(false) @map("sent_whatsapp")
  sentAt        DateTime? @map("sent_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  installment Installment @relation(fields: [installmentId], references: [id])
  client      Client      @relation(fields: [clientId], references: [id])

  @@index([installmentId])
  @@map("pix_payments")
}

model MpPayment {
  id                Int      @id @default(autoincrement())
  installmentId     Int      @map("installment_id")
  preferenceId      String?  @map("preference_id")
  paymentId         String?  @map("payment_id")
  status            String   @default("pending")
  valor             Decimal  @db.Decimal(10, 2)
  externalReference String?  @map("external_reference")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  installment Installment @relation(fields: [installmentId], references: [id])

  @@index([installmentId])
  @@map("mp_payments")
}

model Renegociacao {
  id             Int      @id @default(autoincrement())
  loanId         Int      @map("loan_id")
  valorTotal     Decimal  @db.Decimal(10, 2) @map("valor_total")
  numeroParcelas Int      @map("numero_parcelas")
  taxaJuros      Decimal  @db.Decimal(5, 2) @map("taxa_juros")
  dataInicio     DateTime @map("data_inicio")
  observacoes    String?  @db.Text
  createdAt      DateTime @default(now()) @map("created_at")

  loan Loan @relation(fields: [loanId], references: [id])

  @@index([loanId])
  @@map("renegociacoes")
}

model Notification {
  id        Int       @id @default(autoincrement())
  clientId  Int       @map("client_id")
  loanId    Int?      @map("loan_id")
  tipo      String    @db.VarChar(20)  // whatsapp | email
  assunto   String?
  mensagem  String    @db.Text
  status    String    @default("pendente")
  sentAt    DateTime? @map("sent_at")
  createdAt DateTime  @default(now()) @map("created_at")

  client Client @relation(fields: [clientId], references: [id])
  loan   Loan?  @relation(fields: [loanId], references: [id])

  @@index([clientId])
  @@map("notifications")
}

model AuditLog {
  id         Int      @id @default(autoincrement())
  userId     Int?     @map("user_id")
  acao       String
  entidade   String?
  entidadeId Int?     @map("entidade_id")
  dados      Json?
  ip         String?
  createdAt  DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([entidade, entidadeId])
  @@map("audit_logs")
}

model SiteSetting {
  id        Int      @id @default(autoincrement())
  chave     String   @unique
  valor     String?  @db.Text
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("site_settings")
}

model SupportTicket {
  id        Int      @id @default(autoincrement())
  clientId  Int      @map("client_id")
  assunto   String
  mensagem  String   @db.Text
  status    String   @default("aberto")
  resposta  String?  @db.Text
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@index([clientId])
  @@map("support_tickets")
}
```

---

## Supabase Storage

**Bucket:** `client-documents` (privado, 10 MB máx, image/jpeg|png|webp + application/pdf)

| Path no bucket | Conteúdo |
|----------------|----------|
| `{clientId}/foto_*` | Foto do cliente |
| `{clientId}/rg_*` | Documento RG (frente) |
| `{clientId}/comprovante_*` | Comprovante de endereço |

### RLS em storage.objects

```sql
-- service_role (backend): acesso total ao bucket
CREATE POLICY "service_role_client_documents_all" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'client-documents')
  WITH CHECK (bucket_id = 'client-documents');

-- authenticated: operações CRUD
CREATE POLICY "authenticated_client_documents_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'client-documents');

CREATE POLICY "authenticated_client_documents_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "authenticated_client_documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'client-documents')
  WITH CHECK (bucket_id = 'client-documents');

CREATE POLICY "authenticated_client_documents_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'client-documents');
```

---

## Row Level Security (RLS)

RLS habilitado em todas as 16 tabelas. Categorias:

**Tabelas operacionais** (SELECT para `authenticated`):
`clients`, `loans`, `installments`, `payments`, `transactions`,
`pix_payments`, `mp_payments`, `renegociacoes`, `notifications`, `support_tickets`

**Tabelas admin-only** (RLS ativo sem policies = acesso zero para roles não-service_role):
`users`, `audit_logs`, `site_settings` e demais tabelas administrativas

> Todo acesso de dados ocorre via backend com `service_role` key (bypass RLS).
> As policies de `authenticated` são necessárias para Supabase Realtime funcionar.

---

## Supabase Realtime

Publication `supabase_realtime` configurada nas tabelas:
- `installments` — INSERT, UPDATE
- `payments` — INSERT, DELETE
- `transactions` — INSERT

Usado pelo hook `useRealtimeDashboard()` no frontend para invalidação automática de queries.

---

## Migrations

```powershell
# Aplicar em produção
npx prisma migrate deploy

# Status das migrações
npx prisma migrate status

# Gerar nova migração (desenvolvimento)
npx prisma migrate dev --name descricao_da_mudanca

# Gerar Prisma Client após alterar schema
npx prisma generate
```
