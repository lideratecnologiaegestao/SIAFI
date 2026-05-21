-- Migration: split_parcela
-- Introduz o modelo Split de Parcela (principalAmount + targetProfit + netGain)
-- Renomeia campos em loans e installments; popula dados históricos proporcionalmente.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1: loans — renomear campo principal (valor → principal_amount)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "loans" RENAME COLUMN "valor" TO "principal_amount";

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: loans — renomear valor_investido → target_profit
--   Era opcional (nullable) e usava significados inconsistentes.
--   Agora representa o lucro absoluto alvo do contrato (obrigatório).
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "loans" RENAME COLUMN "valor_investido" TO "target_profit";

-- Historico com NULL → zerar (sem lucro definido); depois tornar NOT NULL
UPDATE "loans" SET "target_profit" = 0 WHERE "target_profit" IS NULL;
ALTER TABLE "loans" ALTER COLUMN "target_profit" SET NOT NULL;
ALTER TABLE "loans" ALTER COLUMN "target_profit" SET DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3: loans — adicionar total_receivable (campo calculado, auditável)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "loans"
  ADD COLUMN "total_receivable" DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Popula: principal_amount + target_profit
UPDATE "loans"
SET "total_receivable" = "principal_amount" + "target_profit";

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 4: loans — adicionar consultor_id (FK para users, nullable)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "loans"
  ADD COLUMN "consultor_id" INTEGER;

ALTER TABLE "loans"
  ADD CONSTRAINT "loans_consultor_id_fkey"
  FOREIGN KEY ("consultor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "loans_consultor_id_idx" ON "loans"("consultor_id");

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 5: loans — tornar campos @deprecated opcionais (nullable)
--   taxa_juros, modo_taxa, tipo_amortizacao não são usados em novos contratos.
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "loans" ALTER COLUMN "taxa_juros"       DROP NOT NULL;
ALTER TABLE "loans" ALTER COLUMN "modo_taxa"        DROP NOT NULL;
ALTER TABLE "loans" ALTER COLUMN "tipo_amortizacao" DROP NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 6: installments — renomear valor → installment_amount
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "installments" RENAME COLUMN "valor" TO "installment_amount";

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 7: installments — adicionar principal_payback e net_gain
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "installments"
  ADD COLUMN "principal_payback" DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "net_gain"          DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 8: installments — popular dados históricos proporcionalmente
--
--   Para dados existentes, o split é calculado como:
--     principal_payback = ROUND(loan.principal_amount / loan.numero_parcelas, 2)
--     net_gain          = ROUND(loan.target_profit    / loan.numero_parcelas, 2)
--
--   A invariante (installmentAmount = principalPayback + netGain) pode diferir
--   em centavos por arredondamento — aceitável em dados históricos.
--   Novos contratos aplicam o algoritmo de ajuste na última parcela.
-- ══════════════════════════════════════════════════════════════════════════════
UPDATE "installments" i
SET
  "principal_payback" = ROUND(
    l."principal_amount" / NULLIF(l."numero_parcelas", 0)::numeric,
    2
  ),
  "net_gain" = ROUND(
    l."target_profit" / NULLIF(l."numero_parcelas", 0)::numeric,
    2
  )
FROM "loans" l
WHERE i."loan_id" = l."id";
