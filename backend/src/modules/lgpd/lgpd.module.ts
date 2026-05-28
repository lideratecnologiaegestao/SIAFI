import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../prisma/prisma.module';
import { QUEUE_FINANCE_NOTIFICATIONS } from '../queue/queue.constants';
import { LgpdService } from './lgpd.service';
import { LgpdPortalController } from './lgpd-portal.controller';
import { LgpdAdminController } from './lgpd-admin.controller';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_FINANCE_NOTIFICATIONS }),
  ],
  controllers: [LgpdPortalController, LgpdAdminController],
  providers: [LgpdService],
  exports: [LgpdService],
})
export class LgpdModule {}
