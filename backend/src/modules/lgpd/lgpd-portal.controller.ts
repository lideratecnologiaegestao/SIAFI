import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';
import { LgpdService } from './lgpd.service';

const TIPOS_CONSENTIMENTO = [
  'termos_uso', 'politica_privacidade', 'cookies_analiticos',
  'marketing_whatsapp', 'marketing_email',
] as const;

const TIPOS_SOLICITACAO = [
  'acesso', 'retificacao', 'exclusao', 'portabilidade',
  'oposicao', 'revogacao_consentimento', 'informacao',
] as const;

class RegistrarConsentimentoDto {
  @IsIn(TIPOS_CONSENTIMENTO as unknown as string[])
  tipo: string;

  @IsString() @IsNotEmpty()
  versao: string;

  @IsBoolean()
  aceito: boolean;
}

class CriarSolicitacaoDto {
  @IsIn(TIPOS_SOLICITACAO as unknown as string[])
  tipo: string;

  @IsString() @IsNotEmpty()
  descricao: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('cliente')
@Controller('portal/lgpd')
export class LgpdPortalController {
  constructor(private readonly service: LgpdService) {}

  @Post('consentimento')
  registrarConsentimento(
    @CurrentUser() user: RequestUser,
    @Body() dto: RegistrarConsentimentoDto,
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.service.registrarConsentimento(user.id, dto, ip, ua ?? '');
  }

  @Get('consentimentos')
  listarConsentimentos(@CurrentUser() user: RequestUser) {
    return this.service.listarConsentimentos(user.id);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('solicitacao')
  criarSolicitacao(
    @CurrentUser() user: RequestUser,
    @Body() dto: CriarSolicitacaoDto,
    @Ip() ip: string,
  ) {
    return this.service.criarSolicitacao(
      user.id,
      (user as any).nome ?? '',
      (user as any).email ?? '',
      dto,
      ip,
    );
  }

  @Get('solicitacoes')
  listarSolicitacoes(@CurrentUser() user: RequestUser) {
    return this.service.listarSolicitacoes(user.id);
  }

  @Get('meus-dados')
  getMeusDados(@CurrentUser() user: RequestUser) {
    return this.service.getMeusDados(user.id);
  }

  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @Post('exportar-dados')
  exportarDados(@CurrentUser() user: RequestUser) {
    return this.service.enfileirarExportacao(user.id);
  }
}
