import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PaymentWorker } from './workers/payment.worker';

@Module({
  controllers: [WebhookController],
  providers: [PaymentWorker],
})
export class WebhookModule {}
