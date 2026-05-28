import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';
import { LgpdService } from './lgpd.service';

class ResponderSolicitacaoDto {
  @IsString() @IsNotEmpty()
  resposta: string;

  @IsIn(['concluido', 'negado'])
  status: 'concluido' | 'negado';
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lgpd')
export class LgpdAdminController {
  constructor(private readonly service: LgpdService) {}

  @Roles('admin', 'financeiro')
  @Get('solicitacoes')
  listarSolicitacoes(
    @Query('status') status?: string,
    @Query('tipo') tipo?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.service.listarSolicitacoesAdmin({
      status: status || undefined,
      tipo: tipo || undefined,
      page: Number(page),
      limit: Number(limit),
    });
  }

  @Roles('admin', 'financeiro')
  @Get('solicitacoes/:id')
  getSolicitacao(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSolicitacaoDetalhe(id);
  }

  @Roles('admin')
  @Patch('solicitacoes/:id/responder')
  responder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponderSolicitacaoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.responderSolicitacao(id, dto, user.id);
  }

  @Roles('admin')
  @Get('relatorio-consentimentos')
  relatorio() {
    return this.service.relatorioConsentimentos();
  }

  @Roles('admin')
  @Post('anonimizar/:clientId')
  anonimizar(
    @Param('clientId', ParseIntPipe) clientId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.anonimizarCliente(clientId, user.id);
  }
}
