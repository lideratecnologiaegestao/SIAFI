-- Migration: fluxo_campos_tabelas — PARTE 2/2
-- DDL de colunas novas em loans e installments.
-- Depende da _004 ter commitado os novos valores de enum.

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Novos campos em loans
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "aceite_expira_em"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aceite_sla_notificado"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "aceite_sla_consultor"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "liberado_por"            INTEGER,
  ADD COLUMN IF NOT EXISTS "liberado_em"             TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "metodo_liberacao"        VARCHAR(20);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Atualizar installments
-- ══════════════════════════════════════════════════════════════════════════════

-- Zerar NULLs antes de tornar NOT NULL
UPDATE "installments" SET "saldo_devedor" = 0 WHERE "saldo_devedor" IS NULL;

-- Tornar saldo_devedor NOT NULL com DEFAULT 0
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'installments'
      AND column_name = 'saldo_devedor'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE "installments"
      ALTER COLUMN "saldo_devedor" SET NOT NULL,
      ALTER COLUMN "saldo_devedor" SET DEFAULT 0;
  END IF;
END$$;

ALTER TABLE "installments"
  ADD COLUMN IF NOT EXISTS "mora_acumulada" DECIMAL(10, 2) NOT NULL DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Índices para as queries do cron
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "loans_aceite_expira_em_status_idx"
  ON "loans" ("aceite_expira_em", "status");

CREATE INDEX IF NOT EXISTS "installments_parcialmente_pago_venc_idx"
  ON "installments" ("data_vencimento")
  WHERE "status" = 'parcialmente_pago';
