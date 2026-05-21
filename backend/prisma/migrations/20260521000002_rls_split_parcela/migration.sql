-- Migration: rls_split_parcela
-- Consolida as políticas RLS de loans e installments após a introdução
-- do modelo Split de Parcela. Idempotente: usa DROP IF EXISTS antes de CREATE.
-- ─────────────────────────────────────────────────────────────────────────────
-- NOTA: auth.uid() retorna uuid — cast explícito para text é obrigatório
--       porque supabase_id é armazenado como TEXT nas tabelas users e clients.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- loans
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;

-- Operadores autenticados (admin, financeiro, consultor, caixa) — acesso completo
DROP POLICY IF EXISTS "operadores_acesso_loans" ON "loans";
CREATE POLICY "operadores_acesso_loans"
ON "loans"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "users"
    WHERE "users"."supabase_id" = auth.uid()::text
      AND "users"."active" = true
      AND "users"."role" IN ('admin', 'financeiro', 'consultor', 'caixa')
  )
);

-- Clientes do portal — leem apenas seus próprios contratos (somente leitura)
-- ATENÇÃO: target_profit, principal_amount, consultor_id são campos internos.
-- O NestJS (ClientPortalService) nunca os retorna; esta policy restringe as linhas.
DROP POLICY IF EXISTS "cliente_ver_proprios_loans" ON "loans";
CREATE POLICY "cliente_ver_proprios_loans"
ON "loans"
FOR SELECT
TO authenticated
USING (
  "client_id" = (
    SELECT "id" FROM "clients"
    WHERE "supabase_id" = auth.uid()::text
    LIMIT 1
  )
);

-- ══════════════════════════════════════════════════════════════════════════════
-- installments
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE "installments" ENABLE ROW LEVEL SECURITY;

-- Operadores autenticados — acesso completo (net_gain e principal_payback visíveis)
DROP POLICY IF EXISTS "operadores_acesso_installments" ON "installments";
CREATE POLICY "operadores_acesso_installments"
ON "installments"
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM "users"
    WHERE "users"."supabase_id" = auth.uid()::text
      AND "users"."active" = true
      AND "users"."role" IN ('admin', 'financeiro', 'consultor', 'caixa')
  )
);

-- Clientes do portal — leem apenas parcelas dos seus contratos (somente leitura)
-- IMPORTANTE: net_gain e principal_payback são colunas financeiras internas.
-- Esta policy restringe LINHAS. A restrição de COLUNAS é feita no NestJS via SELECT explícito.
DROP POLICY IF EXISTS "cliente_ver_proprias_installments" ON "installments";
CREATE POLICY "cliente_ver_proprias_installments"
ON "installments"
FOR SELECT
TO authenticated
USING (
  "loan_id" IN (
    SELECT "id" FROM "loans"
    WHERE "client_id" = (
      SELECT "id" FROM "clients"
      WHERE "supabase_id" = auth.uid()::text
      LIMIT 1
    )
  )
);
