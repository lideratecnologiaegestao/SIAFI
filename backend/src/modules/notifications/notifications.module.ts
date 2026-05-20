import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { WhatsAppWorker } from './workers/whatsapp.worker';
import { EmailWorker } from './workers/email.worker';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, WhatsAppWorker, EmailWorker],
  exports: [NotificationsService],
})
export class NotificationsModule {}
