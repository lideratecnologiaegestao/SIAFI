import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';
import { ClientPortalService } from './client-portal.service';
import { CobrancaService } from '../cobranca/cobranca.service';

class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  assunto: string;

  @IsString()
  @IsNotEmpty()
  mensagem: string;
}

class UpdateMfaDto {
  @IsBoolean()
  mfaEnabled: boolean;
}

class UpdateNotificacoesDto {
  @IsOptional()
  @IsBoolean()
  notificacoesEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  notificacoesWhatsapp?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cliente')
@Controller('portal')
export class ClientPortalController {
  constructor(
    private readonly service: ClientPortalService,
    private readonly cobranca: CobrancaService,
  ) {}

  // ─── Home ─────────────────────────────────────────────────────────────────

  @Get('home')
  getHome(@CurrentUser() user: RequestUser) {
    return this.service.getHome(user.id);
  }

  // ─── Contratos ────────────────────────────────────────────────────────────

  @Get('contratos')
  getContratos(@CurrentUser() user: RequestUser) {
    return this.service.getContratos(user.id);
  }

  @Get('contratos/:id')
  getContrato(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.getContrato(id, user.id);
  }

  @Patch('contratos/:id/aceitar')
  aceitarContrato(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
    @Ip() ip: string,
  ) {
    return this.service.aceitarContrato(id, user.id, ip);
  }

  // ─── Pagamentos ───────────────────────────────────────────────────────────

  @Get('pagamentos')
  getPagamentos(
    @CurrentUser() user: RequestUser,
    @Query('loanId', new ParseIntPipe({ optional: true })) loanId?: number,
  ) {
    return this.service.getPagamentos(user.id, loanId);
  }

  // ─── PIX ──────────────────────────────────────────────────────────────────

  @Post('pix/gerar')
  gerarPix(
    @Body('installmentId', ParseIntPipe) installmentId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.gerarPix(installmentId, user.id);
  }

  @Get('pix/status/:pixId')
  getPixStatus(
    @Param('pixId', ParseIntPipe) pixId: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.getPixStatus(pixId, user.id);
  }

  // ─── Suporte ──────────────────────────────────────────────────────────────

  @Get('suporte')
  getTickets(@CurrentUser() user: RequestUser) {
    return this.service.getTickets(user.id);
  }

  @Get('suporte/:id')
  getTicket(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.getTicket(id, user.id);
  }

  @Post('suporte')
  createTicket(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.service.createTicket(user.id, dto.assunto, dto.mensagem);
  }

  @Patch('suporte/:id/lido')
  marcarTicketLido(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.marcarTicketLido(id, user.id);
  }

  // ─── Perfil ───────────────────────────────────────────────────────────────

  @Get('perfil')
  getPerfil(@CurrentUser() user: RequestUser) {
    return this.service.getPerfil(user.id);
  }

  @Patch('perfil/primeiro-acesso')
  marcarPrimeiroAcesso(@CurrentUser() user: RequestUser) {
    return this.service.marcarPrimeiroAcessoConcluido(user.id);
  }

  @Patch('notificacoes')
  updateNotificacoes(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateNotificacoesDto,
  ) {
    return this.service.updateNotificacoes(user.id, dto.notificacoesEmail, dto.notificacoesWhatsapp);
  }

  @Patch('perfil/mfa')
  updateMfa(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateMfaDto,
  ) {
    return this.service.updateMfaStatus(user.id, dto.mfaEnabled);
  }

  // ─── Boleto / Cobrança ────────────────────────────────────────────────────

  @Get('parcelas/:id/boleto')
  getBoletoUrl(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cobranca.getBoletoUrl(id, user.id);
  }
}
