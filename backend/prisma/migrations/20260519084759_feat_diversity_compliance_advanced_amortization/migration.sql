-- DropForeignKey
ALTER TABLE `mp_payments` DROP FOREIGN KEY `mp_payments_loanId_fkey`;

-- AlterTable
ALTER TABLE `audit_logs` DROP COLUMN `dados`,
    ADD COLUMN `contexto` JSON NULL,
    ADD COLUMN `dados_antes` JSON NULL,
    ADD COLUMN `dados_depois` JSON NULL,
    ADD COLUMN `hash` VARCHAR(64) NULL,
    ADD COLUMN `user_agent` VARCHAR(512) NULL,
    MODIFY `ip` VARCHAR(45) NULL;

-- AlterTable
ALTER TABLE `clients` ADD COLUMN `anonimizado_em` DATETIME(3) NULL,
    ADD COLUMN `identidade_genero` ENUM('masculino', 'feminino', 'nao_binario', 'genero_fluido', 'agender', 'outro', 'prefiro_nao_informar') NULL,
    ADD COLUMN `lgpd_consent_at` DATETIME(3) NULL,
    ADD COLUMN `nome_social` VARCHAR(191) NULL,
    ADD COLUMN `pronome` VARCHAR(30) NULL,
    ADD COLUMN `risk_level` ENUM('muito_baixo', 'baixo', 'medio', 'alto', 'muito_alto', 'sem_score') NOT NULL DEFAULT 'sem_score',
    ADD COLUMN `score_numerico` INTEGER NULL,
    MODIFY `cpf` VARCHAR(255) NULL,
    MODIFY `rg` VARCHAR(255) NULL;

-- AlterTable
ALTER TABLE `installments` ADD COLUMN `saldo_devedor` DECIMAL(15, 2) NULL,
    ADD COLUMN `valor_juros` DECIMAL(15, 2) NULL,
    ADD COLUMN `valor_mora` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `valor_multa` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `valor_principal` DECIMAL(15, 2) NULL,
    MODIFY `valor` DECIMAL(15, 2) NOT NULL,
    MODIFY `total_pago` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `loans` ADD COLUMN `metodo_pagamento` ENUM('dinheiro', 'pix', 'mercadopago', 'transferencia', 'cheque', 'cartao') NULL,
    ADD COLUMN `periodo_carencia` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `taxa_mora` DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
    ADD COLUMN `taxa_multa` DECIMAL(5, 2) NOT NULL DEFAULT 2.00,
    ADD COLUMN `tipo_amortizacao` ENUM('simples', 'price', 'sac') NOT NULL DEFAULT 'simples',
    MODIFY `valor` DECIMAL(15, 2) NOT NULL,
    MODIFY `valor_investido` DECIMAL(15, 2) NULL,
    MODIFY `taxa_juros` DECIMAL(8, 4) NOT NULL;

-- AlterTable
ALTER TABLE `mp_payments` DROP COLUMN `loanId`,
    ADD COLUMN `loan_id` INTEGER NULL,
    MODIFY `valor` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `payments` ADD COLUMN `estornado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `estornado_em` DATETIME(3) NULL,
    ADD COLUMN `estornado_por` INTEGER NULL,
    MODIFY `valor_pago` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `pix_payments` MODIFY `amount` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `refresh_tokens` ADD COLUMN `ip` VARCHAR(45) NULL,
    ADD COLUMN `user_agent` VARCHAR(512) NULL;

-- AlterTable
ALTER TABLE `renegociacoes` ADD COLUMN `motivo_renegociacao` VARCHAR(100) NULL,
    ADD COLUMN `parcelas_renegociadas_ids` JSON NULL,
    ADD COLUMN `tipo_amortizacao` ENUM('simples', 'price', 'sac') NOT NULL DEFAULT 'simples',
    ADD COLUMN `valor_descontado` DECIMAL(15, 2) NULL,
    MODIFY `valor_total` DECIMAL(15, 2) NOT NULL,
    MODIFY `taxa_juros` DECIMAL(8, 4) NOT NULL;

-- AlterTable
ALTER TABLE `transactions` ADD COLUMN `payment_id` INTEGER NULL,
    MODIFY `valor` DECIMAL(15, 2) NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `last_login_at` DATETIME(3) NULL,
    ADD COLUMN `last_login_ip` VARCHAR(45) NULL,
    ADD COLUMN `locked_until` DATETIME(3) NULL,
    ADD COLUMN `mfa_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `mfa_secret` VARCHAR(64) NULL,
    MODIFY `password` VARCHAR(255) NOT NULL;

-- CreateTable
CREATE TABLE `consent_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `tipo` ENUM('uso_dados', 'comunicacao_whatsapp', 'comunicacao_email', 'compartilhamento_bureaus', 'marketing') NOT NULL,
    `acao` ENUM('concedido', 'revogado') NOT NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(512) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consent_logs_client_id_idx`(`client_id`),
    INDEX `consent_logs_tipo_acao_idx`(`tipo`, `acao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_deletion_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `motivo` TEXT NULL,
    `status` ENUM('solicitado', 'em_analise', 'anonimizado', 'rejeitado') NOT NULL DEFAULT 'solicitado',
    `analisado_por` INTEGER NULL,
    `analisado_em` DATETIME(3) NULL,
    `observacoes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `data_deletion_requests_client_id_status_idx`(`client_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `credit_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `risk_level` ENUM('muito_baixo', 'baixo', 'medio', 'alto', 'muito_alto', 'sem_score') NOT NULL,
    `fonte` VARCHAR(50) NULL,
    `dados_brutos` JSON NULL,
    `valido_ate` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `credit_scores_client_id_idx`(`client_id`),
    INDEX `credit_scores_valido_ate_idx`(`valido_ate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `audit_logs_created_at_idx` ON `audit_logs`(`created_at`);

-- CreateIndex
CREATE INDEX `clients_risk_level_idx` ON `clients`(`risk_level`);

-- AddForeignKey
ALTER TABLE `consent_logs` ADD CONSTRAINT `consent_logs_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `data_deletion_requests` ADD CONSTRAINT `data_deletion_requests_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `credit_scores` ADD CONSTRAINT `credit_scores_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mp_payments` ADD CONSTRAINT `mp_payments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
