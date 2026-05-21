import { Module } from '@nestjs/common';
import { ScoreRiscoService } from './score-risco.service';

@Module({
  providers: [ScoreRiscoService],
  exports:   [ScoreRiscoService],
})
export class ScoreRiscoModule {}
