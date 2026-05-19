-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('admin', 'financeiro', 'caixa', 'usuario', 'cliente') NOT NULL DEFAULT 'usuario',
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `token` VARCHAR(512) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NULL,
    `rg` VARCHAR(191) NULL,
    `data_nascimento` DATETIME(3) NULL,
    `email` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `endereco` VARCHAR(191) NULL,
    `bairro` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `estado` CHAR(2) NULL,
    `cep` VARCHAR(191) NULL,
    `foto_path` VARCHAR(191) NULL,
    `rg_path` VARCHAR(191) NULL,
    `comprovante_path` VARCHAR(191) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `notificacoes_email` BOOLEAN NOT NULL DEFAULT true,
    `observacoes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_cpf_key`(`cpf`),
    INDEX `clients_nome_idx`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `loans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `valor_investido` DECIMAL(10, 2) NULL,
    `taxa_juros` DECIMAL(5, 2) NOT NULL,
    `modo_taxa` VARCHAR(191) NOT NULL DEFAULT 'mensal',
    `numero_parcelas` INTEGER NOT NULL,
    `data_inicio` DATETIME(3) NOT NULL,
    `status` ENUM('ativo', 'quitado', 'cancelado', 'inadimplente') NOT NULL DEFAULT 'ativo',
    `observacoes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `loans_client_id_idx`(`client_id`),
    INDEX `loans_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `installments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loan_id` INTEGER NOT NULL,
    `numero` INTEGER NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `data_vencimento` DATETIME(3) NOT NULL,
    `status` ENUM('pendente', 'pago', 'atrasado', 'cancelado') NOT NULL DEFAULT 'pendente',
    `total_pago` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `installments_loan_id_idx`(`loan_id`),
    INDEX `installments_status_idx`(`status`),
    INDEX `installments_data_vencimento_idx`(`data_vencimento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `installment_id` INTEGER NOT NULL,
    `valor_pago` DECIMAL(10, 2) NOT NULL,
    `data_pagamento` DATETIME(3) NOT NULL,
    `metodo_pagamento` ENUM('dinheiro', 'pix', 'mercadopago', 'transferencia', 'cheque', 'cartao') NOT NULL DEFAULT 'dinheiro',
    `observacao` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payments_installment_id_idx`(`installment_id`),
    INDEX `payments_data_pagamento_idx`(`data_pagamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transactions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` VARCHAR(10) NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `categoria` VARCHAR(191) NULL,
    `data` DATETIME(3) NOT NULL,
    `user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `transactions_data_idx`(`data`),
    INDEX `transactions_tipo_idx`(`tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pix_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `installment_id` INTEGER NOT NULL,
    `client_id` INTEGER NOT NULL,
    `payment_id` VARCHAR(191) NULL,
    `qr_code` TEXT NULL,
    `qr_image` TEXT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pendente',
    `sent_whatsapp` BOOLEAN NOT NULL DEFAULT false,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pix_payments_installment_id_idx`(`installment_id`),
    INDEX `pix_payments_payment_id_idx`(`payment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mp_payments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `installment_id` INTEGER NOT NULL,
    `preference_id` VARCHAR(191) NULL,
    `payment_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `valor` DECIMAL(10, 2) NOT NULL,
    `external_reference` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `loanId` INTEGER NULL,

    INDEX `mp_payments_installment_id_idx`(`installment_id`),
    INDEX `mp_payments_external_reference_idx`(`external_reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `renegociacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `loan_id` INTEGER NOT NULL,
    `valor_total` DECIMAL(10, 2) NOT NULL,
    `numero_parcelas` INTEGER NOT NULL,
    `taxa_juros` DECIMAL(5, 2) NOT NULL,
    `data_inicio` DATETIME(3) NOT NULL,
    `observacoes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `renegociacoes_loan_id_idx`(`loan_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `loan_id` INTEGER NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `assunto` VARCHAR(191) NULL,
    `mensagem` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pendente',
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_client_id_idx`(`client_id`),
    INDEX `notifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `acao` VARCHAR(191) NOT NULL,
    `entidade` VARCHAR(191) NULL,
    `entidade_id` INTEGER NULL,
    `dados` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_entidade_entidade_id_idx`(`entidade`, `entidade_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `chave` VARCHAR(191) NOT NULL,
    `valor` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_settings_chave_key`(`chave`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `assunto` VARCHAR(191) NOT NULL,
    `mensagem` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'aberto',
    `resposta` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `support_tickets_client_id_idx`(`client_id`),
    INDEX `support_tickets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `loans` ADD CONSTRAINT `loans_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `installments` ADD CONSTRAINT `installments_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_installment_id_fkey` FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transactions` ADD CONSTRAINT `transactions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pix_payments` ADD CONSTRAINT `pix_payments_installment_id_fkey` FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pix_payments` ADD CONSTRAINT `pix_payments_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mp_payments` ADD CONSTRAINT `mp_payments_installment_id_fkey` FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mp_payments` ADD CONSTRAINT `mp_payments_loanId_fkey` FOREIGN KEY (`loanId`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `renegociacoes` ADD CONSTRAINT `renegociacoes_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_loan_id_fkey` FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
