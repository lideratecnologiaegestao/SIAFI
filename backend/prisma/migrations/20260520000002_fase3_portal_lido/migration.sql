-- Add lido field to support_tickets for unread notification badge
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "lido" BOOLEAN NOT NULL DEFAULT false;
