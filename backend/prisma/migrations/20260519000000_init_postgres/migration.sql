-- Migration: init_postgres
-- Applied: 2026-05-19 via Supabase MCP
-- Migrated from: MySQL (siafi_v2) → PostgreSQL (Supabase)

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE "UserRole" AS ENUM ('admin', 'financeiro', 'caixa', 'usuario', 'cliente');
CREATE TYPE "LoanStatus" AS ENUM ('ativo', 'quitado', 'cancelado', 'inadimplente');
CREATE TYPE "InstallmentStatus" AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE "PaymentMethod" AS ENUM ('dinheiro', 'pix', 'mercadopago', 'transferencia', 'cheque', 'cartao');
CREATE TYPE "AmortizationType" AS ENUM ('simples', 'price', 'sac');
CREATE TYPE "GenderIdentity" AS ENUM ('masculino', 'feminino', 'nao_binario', 'genero_fluido', 'agender', 'outro', 'prefiro_nao_informar');
CREATE TYPE "ConsentType" AS ENUM ('uso_dados', 'comunicacao_whatsapp', 'comunicacao_email', 'compartilhamento_bureaus', 'marketing');
CREATE TYPE "ConsentAction" AS ENUM ('concedido', 'revogado');
CREATE TYPE "RiskLevel" AS ENUM ('muito_baixo', 'baixo', 'medio', 'alto', 'muito_alto', 'sem_score');
CREATE TYPE "DataDeletionStatus" AS ENUM ('solicitado', 'em_analise', 'anonimizado', 'rejeitado');

-- ─── users ────────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
  "id"                    SERIAL PRIMARY KEY,
  "nome"                  TEXT NOT NULL,
  "username"              TEXT NOT NULL UNIQUE,
  "password"              VARCHAR(255) NOT NULL,
  "role"                  "UserRole" NOT NULL DEFAULT 'usuario',
  "active"                BOOLEAN NOT NULL DEFAULT true,
  "supabase_id"           TEXT UNIQUE,
  "mfa_enabled"           BOOLEAN NOT NULL DEFAULT false,
  "mfa_secret"            VARCHAR(64),
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until"          TIMESTAMP(3),
  "last_login_at"         TIMESTAMP(3),
  "last_login_ip"         VARCHAR(45),
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── clients ──────────────────────────────────────────────────────────────────
CREATE TABLE "clients" (
  "id"                 SERIAL PRIMARY KEY,
  "nome"               TEXT NOT NULL,
  "nome_social"        TEXT,
  "identidade_genero"  "GenderIdentity",
  "pronome"            VARCHAR(30),
  "cpf"                VARCHAR(255) UNIQUE,
  "rg"                 VARCHAR(255),
  "data_nascimento"    TIMESTAMP(3),
  "email"              TEXT,
  "whatsapp"           TEXT,
  "telefone"           TEXT,
  "endereco"           TEXT,
  "bairro"             TEXT,
  "cidade"             TEXT,
  "estado"             CHAR(2),
  "cep"                TEXT,
  "foto_path"          TEXT,
  "rg_path"            TEXT,
  "comprovante_path"   TEXT,
  "user_id"            INTEGER UNIQUE REFERENCES "users"("id") ON DELETE SET NULL,
  "active"             BOOLEAN NOT NULL DEFAULT true,
  "notificacoes_email" BOOLEAN NOT NULL DEFAULT true,
  "observacoes"        TEXT,
  "lgpd_consent_at"    TIMESTAMP(3),
  "anonimizado_em"     TIMESTAMP(3),
  "risk_level"         "RiskLevel" NOT NULL DEFAULT 'sem_score',
  "score_numerico"     INTEGER,
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "clients_nome_idx" ON "clients"("nome");
CREATE INDEX "clients_risk_level_idx" ON "clients"("risk_level");

-- ─── consent_logs ─────────────────────────────────────────────────────────────
CREATE TABLE "consent_logs" (
  "id"         SERIAL PRIMARY KEY,
  "client_id"  INTEGER NOT NULL REFERENCES "clients"("id"),
  "tipo"       "ConsentType" NOT NULL,
  "acao"       "ConsentAction" NOT NULL,
  "ip"         VARCHAR(45),
  "user_agent" VARCHAR(512),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "consent_logs_client_id_idx" ON "consent_logs"("client_id");
CREATE INDEX "consent_logs_tipo_acao_idx"  ON "consent_logs"("tipo", "acao");

-- ─── data_deletion_requests ───────────────────────────────────────────────────
CREATE TABLE "data_deletion_requests" (
  "id"            SERIAL PRIMARY KEY,
  "client_id"     INTEGER NOT NULL REFERENCES "clients"("id"),
  "motivo"        TEXT,
  "status"        "DataDeletionStatus" NOT NULL DEFAULT 'solicitado',
  "analisado_por" INTEGER,
  "analisado_em"  TIMESTAMP(3),
  "observacoes"   TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "data_deletion_requests_client_id_status_idx" ON "data_deletion_requests"("client_id", "status");

-- ─── credit_scores ────────────────────────────────────────────────────────────
CREATE TABLE "credit_scores" (
  "id"           SERIAL PRIMARY KEY,
  "client_id"    INTEGER NOT NULL REFERENCES "clients"("id"),
  "score"        INTEGER NOT NULL,
  "risk_level"   "RiskLevel" NOT NULL,
  "fonte"        VARCHAR(50),
  "dados_brutos" JSONB,
  "valido_ate"   TIMESTAMP(3),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "credit_scores_client_id_idx" ON "credit_scores"("client_id");
CREATE INDEX "credit_scores_valido_ate_idx" ON "credit_scores"("valido_ate");

-- ─── loans ────────────────────────────────────────────────────────────────────
CREATE TABLE "loans" (
  "id"               SERIAL PRIMARY KEY,
  "client_id"        INTEGER NOT NULL REFERENCES "clients"("id"),
  "valor"            DECIMAL(15,2) NOT NULL,
  "valor_investido"  DECIMAL(15,2),
  "taxa_juros"       DECIMAL(8,4) NOT NULL,
  "modo_taxa"        TEXT NOT NULL DEFAULT 'mensal',
  "tipo_amortizacao" "AmortizationType" NOT NULL DEFAULT 'simples',
  "numero_parcelas"  INTEGER NOT NULL,
  "data_inicio"      TIMESTAMP(3) NOT NULL,
  "status"           "LoanStatus" NOT NULL DEFAULT 'ativo',
  "taxa_multa"       DECIMAL(5,2) NOT NULL DEFAULT 2.00,
  "taxa_mora"        DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  "periodo_carencia" INTEGER NOT NULL DEFAULT 0,
  "metodo_pagamento" "PaymentMethod",
  "observacoes"      TEXT,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "loans_client_id_idx" ON "loans"("client_id");
CREATE INDEX "loans_status_idx"    ON "loans"("status");

-- ─── installments ─────────────────────────────────────────────────────────────
CREATE TABLE "installments" (
  "id"              SERIAL PRIMARY KEY,
  "loan_id"         INTEGER NOT NULL REFERENCES "loans"("id"),
  "numero"          INTEGER NOT NULL,
  "valor"           DECIMAL(15,2) NOT NULL,
  "valor_principal" DECIMAL(15,2),
  "valor_juros"     DECIMAL(15,2),
  "saldo_devedor"   DECIMAL(15,2),
  "valor_multa"     DECIMAL(15,2) NOT NULL DEFAULT 0,
  "valor_mora"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "data_vencimento" TIMESTAMP(3) NOT NULL,
  "status"          "InstallmentStatus" NOT NULL DEFAULT 'pendente',
  "total_pago"      DECIMAL(15,2) NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "installments_loan_id_idx"         ON "installments"("loan_id");
CREATE INDEX "installments_status_idx"          ON "installments"("status");
CREATE INDEX "installments_data_vencimento_idx" ON "installments"("data_vencimento");

-- ─── payments ─────────────────────────────────────────────────────────────────
CREATE TABLE "payments" (
  "id"               SERIAL PRIMARY KEY,
  "installment_id"   INTEGER NOT NULL REFERENCES "installments"("id"),
  "valor_pago"       DECIMAL(15,2) NOT NULL,
  "data_pagamento"   TIMESTAMP(3) NOT NULL,
  "metodo_pagamento" "PaymentMethod" NOT NULL DEFAULT 'dinheiro',
  "observacao"       TEXT,
  "estornado"        BOOLEAN NOT NULL DEFAULT false,
  "estornado_em"     TIMESTAMP(3),
  "estornado_por"    INTEGER,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "payments_installment_id_idx" ON "payments"("installment_id");
CREATE INDEX "payments_data_pagamento_idx"  ON "payments"("data_pagamento");

-- ─── transactions ─────────────────────────────────────────────────────────────
CREATE TABLE "transactions" (
  "id"         SERIAL PRIMARY KEY,
  "tipo"       VARCHAR(10) NOT NULL,
  "valor"      DECIMAL(15,2) NOT NULL,
  "descricao"  TEXT,
  "categoria"  TEXT,
  "data"       TIMESTAMP(3) NOT NULL,
  "user_id"    INTEGER REFERENCES "users"("id"),
  "payment_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "transactions_data_idx" ON "transactions"("data");
CREATE INDEX "transactions_tipo_idx" ON "transactions"("tipo");

-- ─── pix_payments ─────────────────────────────────────────────────────────────
CREATE TABLE "pix_payments" (
  "id"              SERIAL PRIMARY KEY,
  "installment_id"  INTEGER NOT NULL REFERENCES "installments"("id"),
  "client_id"       INTEGER NOT NULL REFERENCES "clients"("id"),
  "payment_id"      TEXT,
  "tipo"            TEXT NOT NULL DEFAULT 'pix',
  "qr_code"         TEXT,
  "qr_image"        TEXT,
  "barcode_content" TEXT,
  "boleto_url"      VARCHAR(500),
  "amount"          DECIMAL(15,2) NOT NULL,
  "valor_encargos"  DECIMAL(15,2),
  "status"          TEXT NOT NULL DEFAULT 'pendente',
  "expires_at"      TIMESTAMP(3),
  "sent_whatsapp"   BOOLEAN NOT NULL DEFAULT false,
  "sent_at"         TIMESTAMP(3),
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "pix_payments_installment_id_idx" ON "pix_payments"("installment_id");
CREATE INDEX "pix_payments_payment_id_idx"     ON "pix_payments"("payment_id");
CREATE INDEX "pix_payments_tipo_idx"           ON "pix_payments"("tipo");

-- ─── mp_payments ──────────────────────────────────────────────────────────────
CREATE TABLE "mp_payments" (
  "id"                 SERIAL PRIMARY KEY,
  "installment_id"     INTEGER NOT NULL REFERENCES "installments"("id"),
  "preference_id"      TEXT,
  "payment_id"         TEXT,
  "status"             TEXT NOT NULL DEFAULT 'pending',
  "valor"              DECIMAL(15,2) NOT NULL,
  "external_reference" TEXT,
  "loan_id"            INTEGER REFERENCES "loans"("id"),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "mp_payments_installment_id_idx"     ON "mp_payments"("installment_id");
CREATE INDEX "mp_payments_external_reference_idx" ON "mp_payments"("external_reference");

-- ─── renegociacoes ────────────────────────────────────────────────────────────
CREATE TABLE "renegociacoes" (
  "id"                        SERIAL PRIMARY KEY,
  "loan_id"                   INTEGER NOT NULL REFERENCES "loans"("id"),
  "valor_total"               DECIMAL(15,2) NOT NULL,
  "numero_parcelas"           INTEGER NOT NULL,
  "taxa_juros"                DECIMAL(8,4) NOT NULL,
  "tipo_amortizacao"          "AmortizationType" NOT NULL DEFAULT 'simples',
  "data_inicio"               TIMESTAMP(3) NOT NULL,
  "parcelas_renegociadas_ids" JSONB,
  "valor_descontado"          DECIMAL(15,2),
  "motivo_renegociacao"       VARCHAR(100),
  "observacoes"               TEXT,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "renegociacoes_loan_id_idx" ON "renegociacoes"("loan_id");

-- ─── notifications ────────────────────────────────────────────────────────────
CREATE TABLE "notifications" (
  "id"         SERIAL PRIMARY KEY,
  "client_id"  INTEGER NOT NULL REFERENCES "clients"("id"),
  "loan_id"    INTEGER REFERENCES "loans"("id"),
  "tipo"       VARCHAR(20) NOT NULL,
  "assunto"    TEXT,
  "mensagem"   TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'pendente',
  "sent_at"    TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_client_id_idx" ON "notifications"("client_id");
CREATE INDEX "notifications_status_idx"    ON "notifications"("status");

-- ─── audit_logs ───────────────────────────────────────────────────────────────
CREATE TABLE "audit_logs" (
  "id"           SERIAL PRIMARY KEY,
  "user_id"      INTEGER REFERENCES "users"("id"),
  "acao"         TEXT NOT NULL,
  "entidade"     TEXT,
  "entidade_id"  INTEGER,
  "dados_antes"  JSONB,
  "dados_depois" JSONB,
  "contexto"     JSONB,
  "hash"         VARCHAR(64),
  "ip"           VARCHAR(45),
  "user_agent"   VARCHAR(512),
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_user_id_idx"              ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_entidade_entidade_id_idx" ON "audit_logs"("entidade", "entidade_id");
CREATE INDEX "audit_logs_created_at_idx"           ON "audit_logs"("created_at");

-- ─── site_settings ────────────────────────────────────────────────────────────
CREATE TABLE "site_settings" (
  "id"         SERIAL PRIMARY KEY,
  "chave"      TEXT NOT NULL UNIQUE,
  "valor"      TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── support_tickets ──────────────────────────────────────────────────────────
CREATE TABLE "support_tickets" (
  "id"         SERIAL PRIMARY KEY,
  "client_id"  INTEGER NOT NULL REFERENCES "clients"("id"),
  "assunto"    TEXT NOT NULL,
  "mensagem"   TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'aberto',
  "resposta"   TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "support_tickets_client_id_idx" ON "support_tickets"("client_id");
CREATE INDEX "support_tickets_status_idx"    ON "support_tickets"("status");
