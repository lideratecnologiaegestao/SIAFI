#!/usr/bin/env ts-node
/**
 * scaffold.ts — Gera a estrutura de arquivos do módulo de pagamentos
 *
 * Uso: ts-node scaffold.ts [--output ./src]
 */
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const outputFlag = args.indexOf('--output');
const outputDir = outputFlag !== -1 ? args[outputFlag + 1] : './src';
const paymentsDir = path.join(outputDir, 'payments');

const files: Record<string, string> = {
  'payments.module.ts': `import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MercadoPagoConfig } from 'mercadopago';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SubscriptionsService } from './subscriptions.service';
import { PixService } from './pix.service';
import { BoletoService } from './boleto.service';
import { WebhookController } from './webhook.controller';
import { AlertsProcessor } from './alerts/alerts.processor';
import { AlertsScheduler } from './alerts/alerts.scheduler';

export const MP_CLIENT = 'MP_CLIENT';

@Module({
  imports: [BullModule.registerQueue({ name: 'payment-alerts' })],
  controllers: [PaymentsController, WebhookController],
  providers: [
    {
      provide: MP_CLIENT,
      useFactory: () =>
        new MercadoPagoConfig({
          accessToken: process.env.MP_ACCESS_TOKEN!,
          options: { timeout: 10_000 },
        }),
    },
    PaymentsService,
    SubscriptionsService,
    PixService,
    BoletoService,
    AlertsProcessor,
    AlertsScheduler,
  ],
  exports: [PaymentsService, SubscriptionsService],
})
export class PaymentsModule {}
`,

  'interfaces/payment-status.enum.ts': `export enum PaymentStatus {
  PENDING      = 'pending',
  APPROVED     = 'approved',
  REJECTED     = 'rejected',
  CANCELLED    = 'cancelled',
  REFUNDED     = 'refunded',
  IN_PROCESS   = 'in_process',
  IN_MEDIATION = 'in_mediation',
  CHARGED_BACK = 'charged_back',
}

export enum SubscriptionStatus {
  AUTHORIZED = 'authorized',
  PAUSED     = 'paused',
  CANCELLED  = 'cancelled',
  PENDING    = 'pending',
}
`,

  'dto/create-pix.dto.ts': `import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePixDto {
  @IsNumber() @Min(0.01)
  amount: number;

  @IsString() @IsNotEmpty()
  description: string;

  @IsString() @IsNotEmpty()
  externalReference: string;

  @IsEmail()
  payerEmail: string;

  @IsString() @IsNotEmpty()
  payerFirstName: string;

  @IsString() @IsNotEmpty()
  payerLastName: string;

  @IsString() @IsNotEmpty()
  payerCpf: string;

  @IsOptional() @IsNumber()
  expirationMinutes?: number;
}
`,

  'dto/create-boleto.dto.ts': `import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBoletoDto {
  @IsNumber() @Min(0.01)
  amount: number;

  @IsString() @IsNotEmpty()
  description: string;

  @IsString() @IsNotEmpty()
  externalReference: string;

  @IsOptional() @IsNumber()
  daysToExpire?: number;

  @IsEmail()
  payerEmail: string;

  @IsString() @IsNotEmpty()
  payerFirstName: string;

  @IsString() @IsNotEmpty()
  payerLastName: string;

  @IsString() @IsNotEmpty()
  payerCpf: string;

  @IsString() @IsNotEmpty()
  payerZipCode: string;

  @IsString() @IsNotEmpty()
  payerStreetName: string;

  @IsString() @IsNotEmpty()
  payerStreetNumber: string;

  @IsString() @IsNotEmpty()
  payerNeighborhood: string;

  @IsString() @IsNotEmpty()
  payerCity: string;

  @IsString() @IsNotEmpty()
  payerState: string;

  @IsOptional() @IsString()
  paymentMethodId?: string;
}
`,

  'dto/create-subscription.dto.ts': `import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreatePlanDto {
  @IsString() @IsNotEmpty()
  reason: string;

  @IsNumber()
  amount: number;

  @IsString()
  frequencyType: 'days' | 'months';

  @IsNumber()
  frequency: number;

  @IsOptional() @IsNumber()
  repetitions?: number;

  @IsOptional() @IsNumber()
  billingDay?: number;

  @IsString() @IsNotEmpty()
  backUrl: string;
}

export class CreateSubscriptionDto {
  @IsString() @IsNotEmpty()
  planId: string;

  @IsEmail()
  payerEmail: string;

  @IsOptional() @IsString()
  cardTokenId?: string;

  @IsString() @IsNotEmpty()
  externalReference: string;

  @IsOptional() @IsString()
  startDate?: string;

  @IsOptional() @IsString()
  endDate?: string;

  @IsString() @IsNotEmpty()
  backUrl: string;
}
`,

  'guards/webhook-signature.guard.ts': `import {
  CanActivate, ExecutionContext, Injectable,
  UnauthorizedException, Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req: Request = context.switchToHttp().getRequest();
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret) return true; // dev only

    const xSignature = req.headers['x-signature'] as string;
    const xRequestId = req.headers['x-request-id'] as string;
    if (!xSignature) throw new UnauthorizedException('x-signature ausente');

    const parts = Object.fromEntries(xSignature.split(';').map((p) => p.split('=')));
    const ts = parts['ts'];
    const receivedHash = parts['v1'];
    const dataId = (req.body as any)?.data?.id ?? '';
    const manifest = \`id:\${dataId};request-id:\${xRequestId};ts:\${ts}\`;

    const expectedHash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
    if (expectedHash !== receivedHash) {
      this.logger.warn(\`Assinatura inválida. manifest="\${manifest}"\`);
      throw new UnauthorizedException('Assinatura webhook inválida');
    }
    return true;
  }
}
`,

  'alerts/.gitkeep': '',
};

// Create directories and files
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(paymentsDir);

for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(paymentsDir, filePath);
  ensureDir(path.dirname(fullPath));
  if (!fs.existsSync(fullPath)) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Criado: ${fullPath}`);
  } else {
    console.log(`⏭️  Já existe: ${fullPath}`);
  }
}

console.log(`
✨ Estrutura criada em ${paymentsDir}

Próximos passos:
1. npm install mercadopago @nestjs/bull bull ioredis @nestjs/schedule @nestjs/event-emitter class-validator
2. Preencher os serviços: pix.service.ts, boleto.service.ts, subscriptions.service.ts
   (copie os exemplos dos references/)
3. Configurar .env com as credenciais do Mercado Pago
4. Registrar PaymentsModule no AppModule
5. Configurar webhook no painel MP: https://www.mercadopago.com.br/developers
`);
