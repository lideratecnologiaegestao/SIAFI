import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { SettingsModule } from '../settings/settings.module';
import { QUEUE_FINANCE_NOTIFICATIONS } from '../queue/queue.constants';
import { CobrancaService } from './cobranca.service';

@Module({
  imports: [
    PrismaModule,
    SupabaseModule,
    SettingsModule,
    BullModule.registerQueue({ name: QUEUE_FINANCE_NOTIFICATIONS }),
  ],
  providers: [CobrancaService],
  exports: [CobrancaService],
})
export class CobrancaModule {}
