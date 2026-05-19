# SIAFI 2.0 — Database (Prisma + MySQL)

## Convenções

- Nomes de tabelas: `snake_case` plural
- Nomes de campos: `snake_case`
- Prisma model names: `PascalCase` singular
- Soft delete via campo `deletedAt DateTime?`
- Timestamps automáticos: `createdAt`, `updatedAt`

## Schema Base (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
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
  id         Int      @id @default(autoincrement())
  nome       String
  username   String   @unique
  password   String
  role       UserRole @default(usuario)
  active     Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]
  transactions  Transaction[]

  @@map("users")
}

model RefreshToken {
  id        Int      @id @default(autoincrement())
  token     String   @unique @db.VarChar(512)
  userId    Int      @map("user_id")
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("refresh_tokens")
}

model Client {
  id           Int       @id @default(autoincrement())
  nome         String
  cpf          String?   @unique
  rg           String?
  dataNascimento DateTime? @map("data_nascimento")
  email        String?
  whatsapp     String?
  telefone     String?
  endereco     String?
  bairro       String?
  cidade       String?
  estado       String?   @db.Char(2)
  cep          String?
  fotoPath     String?   @map("foto_path")
  rgPath       String?   @map("rg_path")
  comprovantePath String? @map("comprovante_path")
  active       Boolean   @default(true)
  notificacoesEmail Boolean @default(true) @map("notificacoes_email")
  observacoes  String?   @db.Text
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  loans         Loan[]
  pixPayments   PixPayment[]
  notifications Notification[]

  @@index([cpf])
  @@index([nome])
  @@map("clients")
}

model Loan {
  id              Int        @id @default(autoincrement())
  clientId        Int        @map("client_id")
  valor           Decimal    @db.Decimal(10, 2)
  valorInvestido  Decimal?   @db.Decimal(10, 2) @map("valor_investido")
  taxaJuros       Decimal    @db.Decimal(5, 2) @map("taxa_juros")
  modoTaxa        String     @default("mensal") @map("modo_taxa")
  numeroParcelas  Int        @map("numero_parcelas")
  dataInicio      DateTime   @map("data_inicio")
  status          LoanStatus @default(ativo)
  observacoes     String?    @db.Text
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

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
  id           Int               @id @default(autoincrement())
  loanId       Int               @map("loan_id")
  numero       Int
  valor        Decimal           @db.Decimal(10, 2)
  dataVencimento DateTime        @map("data_vencimento")
  status       InstallmentStatus @default(pendente)
  totalPago    Decimal           @default(0) @db.Decimal(10, 2) @map("total_pago")
  createdAt    DateTime          @default(now()) @map("created_at")
  updatedAt    DateTime          @updatedAt @map("updated_at")

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
  @@index([metodoPagamento])
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
  id            Int      @id @default(autoincrement())
  installmentId Int      @map("installment_id")
  clientId      Int      @map("client_id")
  paymentId     String?  @map("payment_id")
  qrCode        String?  @db.Text @map("qr_code")
  qrImage       String?  @db.Text @map("qr_image")
  amount        Decimal  @db.Decimal(10, 2)
  status        String   @default("pendente")
  sentWhatsapp  Boolean  @default(false) @map("sent_whatsapp")
  sentAt        DateTime? @map("sent_at")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  installment Installment @relation(fields: [installmentId], references: [id])
  client      Client      @relation(fields: [clientId], references: [id])

  @@index([installmentId])
  @@index([paymentId])
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
  @@index([externalReference])
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
  tipo      String    @db.VarChar(20)   // whatsapp | email
  assunto   String?
  mensagem  String    @db.Text
  status    String    @default("pendente")
  sentAt    DateTime? @map("sent_at")
  createdAt DateTime  @default(now()) @map("created_at")

  client Client @relation(fields: [clientId], references: [id])
  loan   Loan?  @relation(fields: [loanId], references: [id])

  @@index([clientId])
  @@index([status])
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
  id         Int       @id @default(autoincrement())
  clientId   Int       @map("client_id")
  assunto    String
  mensagem   String    @db.Text
  status     String    @default("aberto")
  resposta   String?   @db.Text
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  @@index([clientId])
  @@index([status])
  @@map("support_tickets")
}
```
