import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConsultorService } from './consultor.service';
import { ConsultorController } from './consultor.controller';
import { SolicitacaoController } from './solicitacao.controller';

@Module({
  imports: [PrismaModule],
  providers: [ConsultorService],
  controllers: [ConsultorController, SolicitacaoController],
  exports: [ConsultorService],
})
export class ConsultorModule {}
