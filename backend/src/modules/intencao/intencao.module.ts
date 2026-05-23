import { Module } from '@nestjs/common';
import { IntencaoController } from './intencao.controller';
import { IntencaoService } from './intencao.service';
import { SettingsModule } from '../settings/settings.module';
import { LoansModule } from '../loans/loans.module';
import { QueueModule } from '../queue/queue.module';
import { ClientPortalModule } from '../client-portal/client-portal.module';

@Module({
  imports: [QueueModule, SettingsModule, LoansModule, ClientPortalModule],
  controllers: [IntencaoController],
  providers: [IntencaoService],
  exports: [IntencaoService],
})
export class IntencaoModule {}
