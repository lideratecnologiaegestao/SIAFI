import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsWorker } from './workers/notifications.worker';
import { EmailTemplateModule } from '../email-template/email-template.module';

@Module({
  imports:     [EmailTemplateModule],
  controllers: [NotificationsController],
  providers:   [NotificationsService, NotificationsWorker],
  exports:     [NotificationsService],
})
export class NotificationsModule {}
