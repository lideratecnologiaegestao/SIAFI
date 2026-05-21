import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsultorService } from './consultor.service';
import { ConsultorController } from './consultor.controller';
import { SolicitacaoController } from './solicitacao.controller';
import { IntencaoController } from './intencao.controller';

@Module({
  imports: [PrismaModule],
  providers: [ConsultorService],
  controllers: [ConsultorController, SolicitacaoController, IntencaoController],
  exports: [ConsultorService],
})
export class ConsultorModule {}
