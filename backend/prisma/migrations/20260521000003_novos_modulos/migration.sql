-- Migration: novos_modulos
-- Fase 2: SolicitacaoReparcelamento, ScoreRisco, Mensagem/Conversa
-- + campos SLA em intencoes_emprestimo + rastreabilidade de reparcelamento em loans
-- Idempotente: usa IF NOT EXISTS e IF EXISTS nas DDL

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Atualizar intencoes_emprestimo — campos SLA e feedback
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "intencoes_emprestimo"
  ADD COLUMN IF NOT EXISTS "motivo_rejeicao"      TEXT,
  ADD COLUMN IF NOT EXISTS "motivo_rejeicao_tipo"  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "prazo_analise_horas"   INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "prazo_expiracao_em"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sla_notificado"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sla_escalonado"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "feedback_enviado_em"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "feedback_enviado_por"  INTEGER,
  ADD COLUMN IF NOT EXISTS "feedback_canal"        VARCHAR(20);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Atualizar loans — rastreabilidade de reparcelamento e aceite digital
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE "loans"
  ADD COLUMN IF NOT EXISTS "origem_loan_id"       INTEGER,
  ADD COLUMN IF NOT EXISTS "reparcelamento_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "aceite_cliente_em"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aceite_cliente_ip"    VARCHAR(45),
  ADD COLUMN IF NOT EXISTS "aceite_cliente_hash"  VARCHAR(64);

-- UNIQUE separado para ser idempotente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loans_origem_loan_id_key'
  ) THEN
    ALTER TABLE "loans" ADD CONSTRAINT "loans_origem_loan_id_key" UNIQUE ("origem_loan_id");
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loans_origem_loan_id_fkey'
  ) THEN
    ALTER TABLE "loans" ADD CONSTRAINT "loans_origem_loan_id_fkey"
      FOREIGN KEY ("origem_loan_id") REFERENCES "loans"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Criar scores_risco
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "scores_risco" (
  "id"                        SERIAL PRIMARY KEY,
  "client_id"                 INTEGER NOT NULL,
  "score_pontualidade"        INTEGER NOT NULL DEFAULT 100,
  "score_reparcelamentos"     INTEGER NOT NULL DEFAULT 100,
  "score_quitacoes"           INTEGER NOT NULL DEFAULT 50,
  "score_geral"               INTEGER NOT NULL DEFAULT 75,
  "classificacao"             VARCHAR(20) NOT NULL DEFAULT 'regular',
  "total_emprestimos"         INTEGER NOT NULL DEFAULT 0,
  "total_quitados"            INTEGER NOT NULL DEFAULT 0,
  "total_reparcelamentos"     INTEGER NOT NULL DEFAULT 0,
  "total_parcelas_atrasadas"  INTEGER NOT NULL DEFAULT 0,
  "calculado_em"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "scores_risco_client_id_key" UNIQUE ("client_id"),
  CONSTRAINT "scores_risco_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Criar solicitacoes_reparcelamento
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "solicitacoes_reparcelamento" (
  "id"                              SERIAL PRIMARY KEY,
  "client_id"                       INTEGER NOT NULL,
  "loan_id"                         INTEGER NOT NULL,
  "consultor_id"                    INTEGER,
  "tipo"                            VARCHAR(30) NOT NULL,
  "motivo_cliente"                  TEXT NOT NULL,
  "data_prevista_pagamento"         TIMESTAMP(3),
  "status"                          VARCHAR(20) NOT NULL DEFAULT 'pendente',
  "novo_valor_principal"            DECIMAL(10,2),
  "novo_target_profit"              DECIMAL(10,2),
  "novo_numero_parcelas"            INTEGER,
  "nova_data_inicio"                TIMESTAMP(3),
  "multa_aplicada"                  DECIMAL(10,2),
  "mora_aplicada"                   DECIMAL(10,2),
  "observacao_financeiro"           TEXT,
  "novo_loan_id"                    INTEGER,
  "respondido_por"                  INTEGER,
  "respondido_em"                   TIMESTAMP(3),
  "executado_por"                   INTEGER,
  "executado_em"                    TIMESTAMP(3),
  "aprovado_segunda_instancia"      BOOLEAN NOT NULL DEFAULT false,
  "aprovado_segunda_instancia_por"  INTEGER,
  "aprovado_segunda_instancia_em"   TIMESTAMP(3),
  "created_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "solicitacoes_reparcelamento_novo_loan_id_key" UNIQUE ("novo_loan_id"),
  CONSTRAINT "solicitacoes_reparcelamento_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "solicitacoes_reparcelamento_loan_id_fkey"
    FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "solicitacoes_reparcelamento_consultor_id_fkey"
    FOREIGN KEY ("consultor_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "solicitacoes_reparcelamento_client_id_idx"
  ON "solicitacoes_reparcelamento"("client_id");
CREATE INDEX IF NOT EXISTS "solicitacoes_reparcelamento_loan_id_idx"
  ON "solicitacoes_reparcelamento"("loan_id");
CREATE INDEX IF NOT EXISTS "solicitacoes_reparcelamento_status_idx"
  ON "solicitacoes_reparcelamento"("status");

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Criar conversas
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "conversas" (
  "id"             SERIAL PRIMARY KEY,
  "titulo"         VARCHAR(255),
  "tipo"           VARCHAR(30) NOT NULL DEFAULT 'direto',
  "intencao_id"    INTEGER,
  "loan_id"        INTEGER,
  "solicitacao_id" INTEGER,
  "client_id"      INTEGER,
  "arquivada"      BOOLEAN NOT NULL DEFAULT false,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversas_intencao_id_fkey"
    FOREIGN KEY ("intencao_id") REFERENCES "intencoes_emprestimo"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "conversas_loan_id_fkey"
    FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "conversas_solicitacao_id_fkey"
    FOREIGN KEY ("solicitacao_id") REFERENCES "solicitacoes_reparcelamento"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "conversas_intencao_id_idx" ON "conversas"("intencao_id");
CREATE INDEX IF NOT EXISTS "conversas_loan_id_idx"     ON "conversas"("loan_id");
CREATE INDEX IF NOT EXISTS "conversas_tipo_idx"        ON "conversas"("tipo");

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Criar mensagens
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "mensagens" (
  "id"            SERIAL PRIMARY KEY,
  "conversa_id"   INTEGER NOT NULL,
  "remetente_id"  INTEGER NOT NULL,
  "conteudo"      TEXT NOT NULL,
  "tipo"          VARCHAR(20) NOT NULL DEFAULT 'texto',
  "arquivo_path"  VARCHAR(500),
  "arquivo_nome"  VARCHAR(255),
  "arquivo_mime"  VARCHAR(100),
  "lida"          BOOLEAN NOT NULL DEFAULT false,
  "lida_em"       TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mensagens_conversa_id_fkey"
    FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mensagens_remetente_id_fkey"
    FOREIGN KEY ("remetente_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mensagens_conversa_id_idx"  ON "mensagens"("conversa_id");
CREATE INDEX IF NOT EXISTS "mensagens_remetente_id_idx" ON "mensagens"("remetente_id");
CREATE INDEX IF NOT EXISTS "mensagens_created_at_idx"   ON "mensagens"("created_at");

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. Criar conversa_participantes
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "conversa_participantes" (
  "id"              SERIAL PRIMARY KEY,
  "conversa_id"     INTEGER NOT NULL,
  "user_id"         INTEGER NOT NULL,
  "role"            VARCHAR(20) NOT NULL DEFAULT 'membro',
  "silenciado"      BOOLEAN NOT NULL DEFAULT false,
  "ultima_leitura"  TIMESTAMP(3),
  "entrada_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversa_participantes_conversa_id_user_id_key" UNIQUE ("conversa_id", "user_id"),
  CONSTRAINT "conversa_participantes_conversa_id_fkey"
    FOREIGN KEY ("conversa_id") REFERENCES "conversas"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversa_participantes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. Seed site_settings financeiros (não sobrescreve valores existentes)
-- ══════════════════════════════════════════════════════════════════════════════
INSERT INTO "site_settings" ("chave", "valor", "updated_at") VALUES
  ('financeiro.multa_atraso_percentual', '2.00',  CURRENT_TIMESTAMP),
  ('financeiro.mora_dia_percentual',     '0.033', CURRENT_TIMESTAMP),
  ('financeiro.max_reparcelamentos',     '3',     CURRENT_TIMESTAMP),
  ('financeiro.sla_intencao_horas',      '24',    CURRENT_TIMESTAMP),
  ('financeiro.sla_escalona_horas',      '48',    CURRENT_TIMESTAMP)
ON CONFLICT ("chave") DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- 9. Supabase Realtime: publicar mensagens e solicitacoes_reparcelamento
-- ══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- mensagens (INSERT — para chat em tempo real)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'mensagens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "mensagens";
  END IF;

  -- solicitacoes_reparcelamento (UPDATE — para acompanhar status)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'solicitacoes_reparcelamento'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "solicitacoes_reparcelamento";
  END IF;
END$$;
