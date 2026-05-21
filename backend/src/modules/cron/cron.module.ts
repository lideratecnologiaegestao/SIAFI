import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { ScoreRiscoModule } from '../score-risco/score-risco.module';
import { SettingsModule } from '../settings/settings.module';
import { CobrancaModule } from '../cobranca/cobranca.module';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_FINANCE_NOTIFICATIONS, QUEUE_PAYMENT_PROCESSING } from '../queue/queue.constants';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ScoreRiscoModule,
    SettingsModule,
    CobrancaModule,
    BullModule.registerQueue(
      { name: QUEUE_FINANCE_NOTIFICATIONS },
      { name: QUEUE_PAYMENT_PROCESSING },
    ),
  ],
  providers: [CronService],
})
export class CronModule {}
