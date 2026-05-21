-- Migration: fluxo_aceite_parcial_liberacao — PARTE 1/2
-- Apenas adição de valores nos enums.
-- Os valores de enum precisam ser commitados antes de poder usar
-- as tabelas que os referenciam (limitação do PostgreSQL).
-- DDL de tabelas está na migration _005.

-- ══════════════════════════════════════════════════════════════════════════════
-- LoanStatus: aguardando_aceite e aguardando_liberacao
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'LoanStatus')
      AND enumlabel = 'aguardando_aceite'
  ) THEN
    ALTER TYPE "LoanStatus" ADD VALUE 'aguardando_aceite';
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'LoanStatus')
      AND enumlabel = 'aguardando_liberacao'
  ) THEN
    ALTER TYPE "LoanStatus" ADD VALUE 'aguardando_liberacao';
  END IF;
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- InstallmentStatus: parcialmente_pago
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'InstallmentStatus')
      AND enumlabel = 'parcialmente_pago'
  ) THEN
    ALTER TYPE "InstallmentStatus" ADD VALUE 'parcialmente_pago';
  END IF;
END$$;
