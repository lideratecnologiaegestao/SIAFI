-- AlterTable pix_payments: add tipo, expires_at, barcode_content, boleto_url, valor_encargos
ALTER TABLE `pix_payments`
  ADD COLUMN `tipo`            VARCHAR(10)    NOT NULL DEFAULT 'pix'   AFTER `payment_id`,
  ADD COLUMN `barcode_content` TEXT           NULL                     AFTER `qr_image`,
  ADD COLUMN `boleto_url`      VARCHAR(500)   NULL                     AFTER `barcode_content`,
  ADD COLUMN `valor_encargos`  DECIMAL(15,2)  NULL                     AFTER `amount`,
  ADD COLUMN `expires_at`      DATETIME(3)    NULL                     AFTER `valor_encargos`;

-- CreateIndex
CREATE INDEX `pix_payments_tipo_idx` ON `pix_payments`(`tipo`);
