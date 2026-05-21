-- Migration: fase1_roles_consultor
-- Fase 1: Roles, Consultor e Portal do Cliente
-- ─────────────────────────────────────────────────────────────────────────────

-- STEP 1: Migrate existing 'usuario' users to 'caixa' before enum change
UPDATE "users" SET "role" = 'caixa' WHERE "role" = 'usuario';

-- STEP 2: Recreate UserRole enum removing 'usuario' and adding 'consultor'
-- PostgreSQL does not support removing enum values directly; requires type recreation.

CREATE TYPE "UserRole_new" AS ENUM ('admin', 'financeiro', 'consultor', 'caixa', 'cliente');

-- Drop column default before altering type
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

-- Alter column to new enum
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new"
  USING "role"::text::"UserRole_new";

-- Restore default with new type
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'caixa'::"UserRole_new";

-- Drop old enum and rename
DROP TYPE "UserRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";

-- STEP 3: New columns on users
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email"            VARCHAR(255) UNIQUE,
  ADD COLUMN IF NOT EXISTS "mfa_login_count"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mfa_decided_at"   TIMESTAMP(3);

-- STEP 4: New columns on clients
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "notificacoes_whatsapp" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "supabase_id"            TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "portal_ativo"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "portal_ativado_em"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "portal_ativado_por"     INTEGER,
  ADD COLUMN IF NOT EXISTS "senha_temporaria"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "primeiro_acesso"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "ultimo_acesso_portal"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mfa_enabled"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "mfa_login_count"        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mfa_decided_at"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "consultor_id"           INTEGER;

-- STEP 5: Foreign key consultor_id → users
ALTER TABLE "clients"
  ADD CONSTRAINT "clients_consultor_id_fkey"
  FOREIGN KEY ("consultor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "clients_consultor_id_idx" ON "clients"("consultor_id");

-- STEP 6: Table consultor_solicitacoes
CREATE TABLE IF NOT EXISTS "consultor_solicitacoes" (
  "id"                 SERIAL PRIMARY KEY,
  "consultor_id"       INTEGER NOT NULL,
  "client_id"          INTEGER NOT NULL,
  "loan_id"            INTEGER,
  "tipo"               VARCHAR(30)  NOT NULL,
  "descricao"          TEXT         NOT NULL,
  "valor_solicitado"   DECIMAL(10,2),
  "status"             VARCHAR(20)  NOT NULL DEFAULT 'pendente',
  "resposta_financeiro" TEXT,
  "respondido_por"     INTEGER,
  "respondido_em"      TIMESTAMP(3),
  "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consultor_solicitacoes_consultor_id_fkey"
    FOREIGN KEY ("consultor_id") REFERENCES "users"("id")    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "consultor_solicitacoes_client_id_fkey"
    FOREIGN KEY ("client_id")   REFERENCES "clients"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "consultor_solicitacoes_loan_id_fkey"
    FOREIGN KEY ("loan_id")     REFERENCES "loans"("id")     ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "consultor_solicitacoes_consultor_id_idx" ON "consultor_solicitacoes"("consultor_id");
CREATE INDEX IF NOT EXISTS "consultor_solicitacoes_client_id_idx"    ON "consultor_solicitacoes"("client_id");
CREATE INDEX IF NOT EXISTS "consultor_solicitacoes_status_idx"       ON "consultor_solicitacoes"("status");

-- STEP 7: Table intencoes_emprestimo
CREATE TABLE IF NOT EXISTS "intencoes_emprestimo" (
  "id"               SERIAL PRIMARY KEY,
  "client_id"        INTEGER       NOT NULL,
  "consultor_id"     INTEGER       NOT NULL,
  "valor_solicitado" DECIMAL(10,2) NOT NULL,
  "numero_parcelas"  INTEGER       NOT NULL,
  "finalidade"       TEXT,
  "status"           VARCHAR(20)   NOT NULL DEFAULT 'aguardando',
  "observacoes"      TEXT,
  "aprovado_por"     INTEGER,
  "aprovado_em"      TIMESTAMP(3),
  "loan_id"          INTEGER UNIQUE,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "intencoes_emprestimo_client_id_fkey"
    FOREIGN KEY ("client_id")    REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "intencoes_emprestimo_consultor_id_fkey"
    FOREIGN KEY ("consultor_id") REFERENCES "users"("id")   ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "intencoes_emprestimo_consultor_id_idx" ON "intencoes_emprestimo"("consultor_id");
CREATE INDEX IF NOT EXISTS "intencoes_emprestimo_status_idx"        ON "intencoes_emprestimo"("status");

-- STEP 8: Table cobranca_contatos
CREATE TABLE IF NOT EXISTS "cobranca_contatos" (
  "id"                SERIAL PRIMARY KEY,
  "installment_id"    INTEGER      NOT NULL,
  "client_id"         INTEGER      NOT NULL,
  "consultor_id"      INTEGER      NOT NULL,
  "canal"             VARCHAR(20)  NOT NULL,
  "resultado"         VARCHAR(50)  NOT NULL,
  "prometeu_pagar_em" TIMESTAMP(3),
  "observacao"        TEXT,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cobranca_contatos_installment_id_fkey"
    FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cobranca_contatos_client_id_fkey"
    FOREIGN KEY ("client_id")      REFERENCES "clients"("id")      ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "cobranca_contatos_consultor_id_fkey"
    FOREIGN KEY ("consultor_id")   REFERENCES "users"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "cobranca_contatos_installment_id_idx" ON "cobranca_contatos"("installment_id");
CREATE INDEX IF NOT EXISTS "cobranca_contatos_client_id_idx"       ON "cobranca_contatos"("client_id");
CREATE INDEX IF NOT EXISTS "cobranca_contatos_consultor_id_idx"    ON "cobranca_contatos"("consultor_id");

-- STEP 9: Add 'lido' column to support_tickets (Fase 3 field, added here to keep migrations clean)
ALTER TABLE "support_tickets"
  ADD COLUMN IF NOT EXISTS "lido" BOOLEAN NOT NULL DEFAULT false;

-- STEP 10: Add 'dados' column to audit_logs (used in new AuditLog entries without dadosAntes/Depois)
ALTER TABLE "audit_logs"
  ADD COLUMN IF NOT EXISTS "dados" JSONB;
