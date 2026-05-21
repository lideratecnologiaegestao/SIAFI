-- Cobrança antecipada: campos em loans
ALTER TABLE loans ADD COLUMN IF NOT EXISTS multa_percentual           DECIMAL(5,4)  NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS mora_diaria_percentual     DECIMAL(7,6)  NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS dias_antecedencia_cobranca INT           NOT NULL DEFAULT 10;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS dia_vencimento             INT           NULL;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS cobrar_whatsapp            BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS cobrar_email               BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS cobrar_portal              BOOLEAN       NOT NULL DEFAULT TRUE;

-- Cobrança antecipada: campos em installments
ALTER TABLE installments ADD COLUMN IF NOT EXISTS cobranca_enviada_em  TIMESTAMPTZ   NULL;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS cobranca_whatsapp_ok BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS cobranca_email_ok    BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS cobranca_portal_ok   BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS multa_aplicada       DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS valor_com_encargos   DECIMAL(15,2) NULL;
ALTER TABLE installments ADD COLUMN IF NOT EXISTS pix_cobranca_id      INT           NULL;

-- Índices para queries de cobrança
CREATE INDEX IF NOT EXISTS installments_cobranca_antecipada_idx
  ON installments (data_vencimento, status)
  WHERE status = 'pendente' AND cobranca_enviada_em IS NULL;

-- Seed / upsert site_settings
INSERT INTO site_settings (chave, valor, updated_at)
VALUES
  ('financeiro.multa_atraso_percentual',    '2.00',  NOW()),
  ('financeiro.mora_dia_percentual',        '0.0333', NOW()),
  ('financeiro.dias_antecedencia_cobranca', '10',    NOW()),
  ('financeiro.cobranca_whatsapp_ativo',    'true',  NOW()),
  ('financeiro.cobranca_email_ativo',       'true',  NOW())
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW();
