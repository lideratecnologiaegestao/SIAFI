# SIAFI 2.0 — Database (Prisma + PostgreSQL / Supabase)

> Última atualização: 2026-05-22
> **Banco:** PostgreSQL via Supabase Cloud (região sa-east-1 — São Paulo)
> **Projeto:** `lvpseuaybpnmrneuyndi`

---

## Conexões

```bash
# Runtime (NestJS / Prisma — Transaction Pooler pgBouncer)
DATABASE_URL="postgresql://postgres.lvpseuaybpnmrneuyndi:PASS@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Migrações DDL (conexão direta — sem pgBouncer)
DIRECT_URL="postgresql://postgres.lvpseuaybpnmrneuyndi:PASS@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

---

## Comandos Prisma

```bash
# Gerar client TypeScript (após alterar schema)
# IMPORTANTE: parar SIAFI-API antes (EPERM no Windows)
sc.exe stop SIAFI-API
npx prisma generate
sc.exe start SIAFI-API

# Criar nova migração (desenvolvimento)
npx prisma migrate dev --name descricao_da_mudanca

# Aplicar migrações em produção
npx prisma migrate deploy

# Status das migrações
npx prisma migrate status

# Abrir Prisma Studio (GUI)
npx prisma studio
```

---

## Modelos (24)

### User
```prisma
model User {
  id               Int       @id @default(autoincrement())
  username         String    @unique
  nome             String
  email            String?   @unique
  passwordHash     String    @map("password_hash")
  role             UserRole  @default(financeiro)
  active           Boolean   @default(true)
  supabaseId       String?   @map("supabase_id")
  mfaEnabled       Boolean   @default(false) @map("mfa_enabled")
  failedLogins     Int       @default(0) @map("failed_logins")
  lockedUntil      DateTime? @map("locked_until")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")
}
```

### Client
```prisma
model Client {
  id                  Int       @id @default(autoincrement())
  nome                String
  cpf                 String?   @unique
  rg                  String?
  dataNascimento      DateTime? @map("data_nascimento")
  email               String?
  whatsapp            String?
  telefone            String?
  endereco            String?
  bairro              String?
  cidade              String?
  estado              String?
  cep                 String?
  observacoes         String?
  active              Boolean   @default(true)
  notificacoesEmail   Boolean   @default(true) @map("notificacoes_email")
  // Documentos
  fotoPath            String?   @map("foto_path")
  rgPath              String?   @map("rg_path")
  comprovantePath     String?   @map("comprovante_path")
  // Portal do cliente
  supabaseId          String?   @map("supabase_id")
  portalAtivo         Boolean   @default(false) @map("portal_ativo")
  portalAtivadoEm     DateTime? @map("portal_ativado_em")
  portalAtivadoPor    Int?      @map("portal_ativado_por")
  ultimoAcessoPortal  DateTime? @map("ultimo_acesso_portal")
  senhaTemporaria     Boolean   @default(false) @map("senha_temporaria")
  primeiroAcesso      Boolean   @default(true)  @map("primeiro_acesso")
  mfaEnabled          Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount       Int       @default(0)     @map("mfa_login_count")
  // Consultor
  consultorId         Int?      @map("consultor_id")
  consultor           User?     @relation("ConsultorClientes", fields: [consultorId], references: [id])
  // Relações
  loans               Loan[]
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt      @map("updated_at")
}
```

### Loan (Contrato)
```prisma
model Loan {
  id                       Int          @id @default(autoincrement())
  clientId                 Int          @map("client_id")
  client                   Client       @relation(fields: [clientId], references: [id])
  valor                    Decimal      @db.Decimal(15,2)
  valorInvestido           Decimal?     @db.Decimal(15,2) @map("valor_investido")
  numeroParcelas           Int          @map("numero_parcelas")
  valorParcela             Decimal      @db.Decimal(15,2) @map("valor_parcela")
  taxaJuros                Decimal?     @db.Decimal(7,4)  @map("taxa_juros")
  dataInicio               DateTime     @map("data_inicio")
  diaVencimento            Int?         @map("dia_vencimento")          // dia fixo 1–28
  status                   LoanStatus   @default(aguardando_aceite)
  metodoPagamento          String?      @map("metodo_pagamento")
  observacoes              String?
  origemLoanId             Int?         @map("origem_loan_id")           // reparcelamento
  reparcelamentoCount      Int          @default(0) @map("reparcelamento_count")
  aceiteClienteHash        String?      @map("aceite_cliente_hash")      // SHA-256
  aceiteClienteEm          DateTime?    @map("aceite_cliente_em")
  metodoLiberacao          String?      @map("metodo_liberacao")
  liberadoPor              Int?         @map("liberado_por")
  liberadoEm               DateTime?    @map("liberado_em")
  // Configuração de cobrança por contrato
  multaPercentual          Decimal?     @db.Decimal(5,4)  @map("multa_percentual")
  moraDiariaPercentual     Decimal?     @db.Decimal(7,6)  @map("mora_diaria_percentual")
  diasAntecedenciaCobranca Int          @default(10)      @map("dias_antecedencia_cobranca")
  cobrarWhatsapp           Boolean      @default(true)    @map("cobrar_whatsapp")
  cobrarEmail              Boolean      @default(true)    @map("cobrar_email")
  cobrarPortal             Boolean      @default(true)    @map("cobrar_portal")
  installments             Installment[]
  createdAt                DateTime     @default(now()) @map("created_at")
  updatedAt                DateTime     @updatedAt      @map("updated_at")
}
```

### Installment (Parcela)
```prisma
model Installment {
  id                  Int               @id @default(autoincrement())
  loanId              Int               @map("loan_id")
  loan                Loan              @relation(fields: [loanId], references: [id])
  numero              Int
  valor               Decimal           @db.Decimal(15,2)
  dataVencimento      DateTime          @map("data_vencimento")
  status              InstallmentStatus @default(pendente)
  saldoDevedor        Decimal           @default(0)  @db.Decimal(15,2) @map("saldo_devedor")
  moraAcumulada       Decimal           @default(0)  @db.Decimal(15,2) @map("mora_acumulada")
  // Cobrança antecipada
  cobrancaEnviadaEm   DateTime?         @map("cobranca_enviada_em")
  cobrancaWhatsappOk  Boolean           @default(false) @map("cobranca_whatsapp_ok")
  cobrancaEmailOk     Boolean           @default(false) @map("cobranca_email_ok")
  cobrancaPortalOk    Boolean           @default(false) @map("cobranca_portal_ok")
  multaAplicada       Decimal           @default(0) @db.Decimal(10,2) @map("multa_aplicada")
  valorComEncargos    Decimal?          @db.Decimal(15,2) @map("valor_com_encargos")
  payments            Payment[]
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @updatedAt      @map("updated_at")
}
```

### Payment (Pagamento)
```prisma
model Payment {
  id               Int           @id @default(autoincrement())
  installmentId    Int           @map("installment_id")
  installment      Installment   @relation(fields: [installmentId], references: [id])
  clientId         Int           @map("client_id")
  loanId           Int           @map("loan_id")
  valor            Decimal       @db.Decimal(15,2)
  dataPagamento    DateTime      @map("data_pagamento")
  metodoPagamento  PaymentMethod @map("metodo_pagamento")
  observacoes      String?
  estornado        Boolean       @default(false)
  estornadoEm      DateTime?     @map("estornado_em")
  estornadoPor     Int?          @map("estornado_por")
  principalPayback Decimal?      @db.Decimal(15,2) @map("principal_payback")  // nunca no portal
  netGain          Decimal?      @db.Decimal(15,2) @map("net_gain")           // nunca no portal
  createdAt        DateTime      @default(now()) @map("created_at")
}
```

### Transaction (Caixa)
```prisma
model Transaction {
  id          Int      @id @default(autoincrement())
  tipo        String   // entrada | saida
  valor       Decimal  @db.Decimal(15,2)
  descricao   String
  referencia  String?
  userId      Int?     @map("user_id")
  createdAt   DateTime @default(now()) @map("created_at")
}
```

### IntencaoEmprestimo
```prisma
model IntencaoEmprestimo {
  id                  Int       @id @default(autoincrement())
  clientId            Int       @map("client_id")
  consultorId         Int?      @map("consultor_id")
  valorSolicitado     Decimal   @db.Decimal(15,2) @map("valor_solicitado")
  finalidade          String?
  observacoes         String?
  status              String    @default("pendente") // pendente|aprovado|rejeitado|expirado
  slaHoras            Int       @default(48) @map("sla_horas")
  prazoResposta       DateTime  @map("prazo_resposta")
  analisadoPor        Int?      @map("analisado_por")
  analisadoEm         DateTime? @map("analisado_em")
  feedback            String?
  loanId              Int?      @map("loan_id")   // preenchido após aprovação
  portalAtivadoAuto   Boolean   @default(false) @map("portal_ativado_auto")
  createdAt           DateTime  @default(now()) @map("created_at")
}
```

### SolicitacaoReparcelamento
```prisma
model SolicitacaoReparcelamento {
  id                    Int       @id @default(autoincrement())
  loanId                Int       @map("loan_id")
  clientId              Int       @map("client_id")
  consultorId           Int?      @map("consultor_id")
  motivoCliente         String?   @map("motivo_cliente")
  status                String    @default("solicitado")
  // solicitado → proposta_enviada → aguardando_aprovacao → aprovado → executado | rejeitado
  novoValorPrincipal    Decimal?  @db.Decimal(15,2) @map("novo_valor_principal")
  novaQtdParcelas       Int?      @map("nova_qtd_parcelas")
  novoValorParcela      Decimal?  @db.Decimal(15,2) @map("novo_valor_parcela")
  novaDataInicio        DateTime? @map("nova_data_inicio")
  observacoesFinanceiro String?   @map("observacoes_financeiro")
  aprovadoPor           Int?      @map("aprovado_por")
  aprovadoEm            DateTime? @map("aprovado_em")
  executadoPor          Int?      @map("executado_por")
  executadoEm           DateTime? @map("executado_em")
  novoLoanId            Int?      @map("novo_loan_id")
  aceiteClienteHash     String?   @map("aceite_cliente_hash")
  createdAt             DateTime  @default(now()) @map("created_at")
}
```

### ScoreRisco
```prisma
model ScoreRisco {
  id                  Int      @id @default(autoincrement())
  clientId            Int      @unique @map("client_id")
  score               Decimal  @db.Decimal(5,2)
  pontualidade        Decimal  @db.Decimal(5,2)
  reparcelamentos     Decimal  @db.Decimal(5,2)
  quitacoes           Decimal  @db.Decimal(5,2)
  totalParcelas       Int      @default(0) @map("total_parcelas")
  parcelasPagas       Int      @default(0) @map("parcelas_pagas")
  parcelasAtrasadas   Int      @default(0) @map("parcelas_atrasadas")
  totalReparcelamentos Int     @default(0) @map("total_reparcelamentos")
  totalQuitacoes      Int      @default(0) @map("total_quitacoes")
  updatedAt           DateTime @updatedAt @map("updated_at")
}
```

### Conversa / Mensagem (Chat)
```prisma
model Conversa {
  id           Int                   @id @default(autoincrement())
  titulo       String?
  participantes ConversaParticipante[]
  mensagens    Mensagem[]
  createdAt    DateTime @default(now()) @map("created_at")
}

model Mensagem {
  id          Int      @id @default(autoincrement())
  conversaId  Int      @map("conversa_id")
  conversa    Conversa @relation(fields: [conversaId], references: [id])
  autorId     Int      @map("autor_id")
  conteudo    String
  createdAt   DateTime @default(now()) @map("created_at")
}

model ConversaParticipante {
  conversaId    Int      @map("conversa_id")
  userId        Int      @map("user_id")
  ultimaLeitura DateTime? @map("ultima_leitura")
  @@id([conversaId, userId])
}
```

### Notification
```prisma
model Notification {
  id        Int      @id @default(autoincrement())
  clientId  Int      @map("client_id")
  loanId    Int?     @map("loan_id")
  tipo      String   // email | whatsapp
  assunto   String
  mensagem  String
  status    String   // enviado | falhou
  sentAt    DateTime? @map("sent_at")
  createdAt DateTime  @default(now()) @map("created_at")
}
```

### AuditLog
```prisma
model AuditLog {
  id          Int       @id @default(autoincrement())
  userId      Int?      @map("user_id")
  user        User?     @relation(fields: [userId], references: [id])
  acao        String    // ex: EMAIL_ENVIADO, PORTAL_ATIVADO, PAGAMENTO_ESTORNADO
  entidade    String?   // ex: client, loan, email, queue
  entidadeId  Int?      @map("entidade_id")
  dadosAntes  Json?     @map("dados_antes")
  dadosDepois Json?     @map("dados_depois")
  contexto    Json?     // detalhes adicionais (destinatário, erro SMTP, etc.)
  ip          String?
  userAgent   String?
  createdAt   DateTime  @default(now()) @map("created_at")
}
```

### SiteSetting (Parâmetros Configuráveis)
```prisma
model SiteSetting {
  id        Int      @id @default(autoincrement())
  chave     String   @unique
  valor     String
  descricao String?
  updatedAt DateTime @updatedAt @map("updated_at")
}
```

**Chaves principais:**
| Chave | Padrão | Descrição |
|-------|--------|-----------|
| `financeiro.taxa_mora_diaria` | `0.001` | Mora diária global (0.1%) |
| `financeiro.taxa_multa` | `0.02` | Multa por atraso global (2%) |
| `financeiro.sla_aceite_dias` | `5` | Dias para aceite do contrato |
| `financeiro.sla_intencao_horas` | `48` | SLA de análise de intenção |
| `financeiro.cobranca_dias_antecedencia` | `10` | Dias antes do vencimento para cobrança |

### Demais Modelos

| Modelo | Função |
|--------|--------|
| `PixPayment` | Dados do QR Code PIX gerado |
| `MpPayment` | Pagamento processado via Mercado Pago |
| `Renegociacao` | Renegociação simples de dívida |
| `SupportTicket` | Ticket de suporte do portal |
| `CobrancaContato` | Log de tentativas de cobrança |
| `ConsultorSolicitacao` | Solicitações feitas pelo consultor |
| `ConsentLog` | Log de consentimentos LGPD |
| `DataDeletionRequest` | Pedidos de exclusão de dados |
| `CreditScore` | Histórico de scores externos |

---

## Enums

```prisma
enum UserRole {
  admin
  financeiro
  caixa
  consultor
  cliente
}

enum LoanStatus {
  aguardando_aceite    // criado, aguardando assinatura do cliente
  aguardando_liberacao // aceito, aguardando entrega do capital
  ativo               // capital entregue, parcelas em andamento
  quitado             // todas as parcelas pagas
  cancelado           // cancelado por SLA ou manualmente
  atrasado            // ativo com parcelas em atraso (derivado)
}

enum InstallmentStatus {
  pendente
  pago
  atrasado
  parcialmente_pago
  cancelado
}

enum PaymentMethod {
  pix
  dinheiro
  transferencia
  boleto
  cartao
  cheque
  outro
}
```

---

## Supabase Storage

### Buckets
| Bucket | Conteúdo | Acesso |
|--------|----------|--------|
| `client-documents` | Foto, RG, comprovante dos clientes | Privado — URLs assinadas (1h) |
| `boletos-cobranca` | PDFs de cobranças geradas | Privado — URLs assinadas (1h) |

```typescript
// Caminho padronizado
`clients/${clientId}/foto.jpg`
`clients/${clientId}/rg.pdf`
`clients/${clientId}/comprovante.jpg`
`${clientId}/parcela_${loanId}_${numero}_${date}.pdf`
```

---

## Row Level Security (RLS)

Aplicar no SQL Editor do Supabase (`lvpseuaybpnmrneuyndi`):

```sql
-- Habilitar RLS
ALTER TABLE loans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- Clientes só veem dados próprios
CREATE POLICY "cliente_ver_proprios_loans" ON loans
  FOR SELECT TO authenticated
  USING (client_id = (
    SELECT id FROM clients WHERE supabase_id = auth.uid() LIMIT 1
  ));

CREATE POLICY "cliente_ver_proprias_installments" ON installments
  FOR SELECT TO authenticated
  USING (loan_id IN (
    SELECT id FROM loans
    WHERE client_id = (
      SELECT id FROM clients WHERE supabase_id = auth.uid() LIMIT 1
    )
  ));
```

---

## Supabase Realtime

```sql
-- Tabela mensagens na publication de realtime
ALTER PUBLICATION supabase_realtime ADD TABLE mensagens;
```

O frontend assina eventos INSERT filtrados por `conversa_id` para o chat interno.

---

## Índices Importantes

```sql
-- Cobrança antecipada
CREATE INDEX installments_cobranca_antecipada_idx
  ON installments (data_vencimento, status, cobranca_enviada_em)
  WHERE status IN ('pendente', 'atrasado');

-- Parcelas em atraso
CREATE INDEX installments_overdue_idx
  ON installments (data_vencimento, status)
  WHERE status = 'pendente';

-- Score de risco
CREATE UNIQUE INDEX score_risco_client_idx ON score_risco (client_id);
```
