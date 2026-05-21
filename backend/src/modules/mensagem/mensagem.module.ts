import { Module } from '@nestjs/common';
import { MensagemController } from './mensagem.controller';
import { MensagemService } from './mensagem.service';

@Module({
  controllers: [MensagemController],
  providers:   [MensagemService],
  exports:     [MensagemService],
})
export class MensagemModule {}
