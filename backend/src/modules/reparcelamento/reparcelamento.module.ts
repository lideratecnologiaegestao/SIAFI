import { Module } from '@nestjs/common';
import { ReparcelamentoController } from './reparcelamento.controller';
import { ReparcelamentoService } from './reparcelamento.service';
import { ScoreRiscoModule } from '../score-risco/score-risco.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [QueueModule, ScoreRiscoModule],
  controllers: [ReparcelamentoController],
  providers: [ReparcelamentoService],
  exports: [ReparcelamentoService],
})
export class ReparcelamentoModule {}
