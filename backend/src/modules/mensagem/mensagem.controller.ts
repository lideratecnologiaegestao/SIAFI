import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MensagemService } from './mensagem.service';
import { CriarConversaDto } from './dto/criar-conversa.dto';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';

interface AuthUser { id: number; username: string; role: string }

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mensagens')
export class MensagemController {
  constructor(private readonly svc: MensagemService) {}

  // Badge de não-lidas (chamada frequente — rota antes de /conversas/:id)
  @Get('badge')
  @Roles('admin', 'financeiro', 'consultor', 'caixa')
  badge(@CurrentUser() user: AuthUser) {
    return this.svc.contarNaoLidas(user.id).then(count => ({ count }));
  }

  @Get('conversas')
  @Roles('admin', 'financeiro', 'consultor', 'caixa')
  findConversas(@CurrentUser() user: AuthUser) {
    return this.svc.findConversas(user.id);
  }

  @Post('conversas')
  @Roles('admin', 'financeiro', 'consultor', 'caixa')
  criarConversa(@Body() dto: CriarConversaDto, @CurrentUser() user: AuthUser) {
    return this.svc.criarConversa(dto, user.id);
  }

  @Get('conversas/:id')
  @Roles('admin', 'financeiro', 'consultor', 'caixa')
  findMensagens(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.findMensagens(id, user.id);
  }

  @Post('conversas/:id')
  @Roles('admin', 'financeiro', 'consultor', 'caixa')
  enviar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: EnviarMensagemDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.enviar(id, dto, user.id);
  }

  @Post('conversas/:id/participantes')
  @Roles('admin', 'financeiro')
  adicionarParticipante(
    @Param('id', ParseIntPipe) id: number,
    @Body('userId', ParseIntPipe) targetUserId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.svc.adicionarParticipante(id, targetUserId, user.id);
  }
}
