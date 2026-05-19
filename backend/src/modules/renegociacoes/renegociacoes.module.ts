import { Module } from '@nestjs/common';
import { RenegociacoesController } from './renegociacoes.controller';
import { RenegociacoesService } from './renegociacoes.service';

@Module({
  controllers: [RenegociacoesController],
  providers: [RenegociacoesService],
  exports: [RenegociacoesService],
})
export class RenegociacoesModule {}
