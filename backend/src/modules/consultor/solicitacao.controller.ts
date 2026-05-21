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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';
import { ConsultorService } from './consultor.service';
import { CreateSolicitacaoDto, ResponderSolicitacaoDto } from './dto/create-solicitacao.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('solicitacoes')
export class SolicitacaoController {
  constructor(private readonly consultorService: ConsultorService) {}

  @Get()
  @Roles('consultor', 'financeiro', 'admin')
  listar(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    return this.consultorService.listarSolicitacoes(user, status);
  }

  @Post()
  @Roles('consultor')
  criar(
    @Body() dto: CreateSolicitacaoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.consultorService.criarSolicitacao(dto, user);
  }

  @Patch(':id/responder')
  @Roles('financeiro', 'admin')
  responder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResponderSolicitacaoDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.consultorService.responderSolicitacao(id, dto, user);
  }
}
