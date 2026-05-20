import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { redisConnection } from './redis.config';
import { QUEUE_FINANCE_NOTIFICATIONS, QUEUE_PAYMENT_PROCESSING } from './queue.constants';
import { QueueDebugController } from './queue.debug.controller';

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: redisConnection,
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_FINANCE_NOTIFICATIONS,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      },
      {
        name: QUEUE_PAYMENT_PROCESSING,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 10000 },
          removeOnComplete: { count: 200 },
          removeOnFail: { count: 1000 },
        },
      },
    ),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_FINANCE_NOTIFICATIONS,
      adapter: BullMQAdapter,
    }),
    BullBoardModule.forFeature({
      name: QUEUE_PAYMENT_PROCESSING,
      adapter: BullMQAdapter,
    }),
  ],
  controllers: [QueueDebugController],
  exports: [BullModule],
})
export class QueueModule {}
