import {
  Controller,
  Post,
  Get,
  Delete,
  Req,
  Res,
  Body,
  Param,
  Ip,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { ValidateGoogleDto } from './dto/validate-google.dto';

interface CurrentUserPayload {
  id: number;
  supabaseId: string;
  username: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /api/auth/login
   * Aceita username, e-mail ou CPF como identificador.
   * Autentica localmente (bcrypt) + via Supabase Auth.
   * Retorna Supabase access_token + seta refresh_token como httpOnly cookie.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.loginComEmailOuCpf(body.identificador, body.password, res);
  }

  /**
   * POST /api/auth/validate-google
   * Chamado pelo callback OAuth logo após exchangeCodeForSession.
   * Verifica se o email está pré-cadastrado; se não, deleta a conta do Supabase e retorna 403.
   * Não usa JwtAuthGuard — a sessão ainda não existe quando este endpoint é chamado.
   */
  @Post('validate-google')
  @HttpCode(HttpStatus.OK)
  async validateGoogle(@Body() dto: ValidateGoogleDto, @Ip() ip: string) {
    return this.authService.validateGoogleOAuth(dto.email, dto.supabaseUserId, ip);
  }

  /**
   * POST /api/auth/refresh
   * Renova a sessão via Supabase usando o httpOnly cookie.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const cookies = req.cookies as Record<string, string>;
    const refreshToken = cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente');
    return this.authService.refresh(refreshToken);
  }

  /**
   * POST /api/auth/logout
   * Revoga a sessão Supabase e limpa o cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    await this.authService.logout(user.supabaseId);
    res.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return { message: 'Sessão encerrada com sucesso' };
  }

  /**
   * GET /api/auth/me
   * Retorna dados do usuário autenticado.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const full = await this.usersService.findById(user.id);
    if (!full) throw new NotFoundException('Usuário não encontrado');
    return { id: full.id, username: full.username, nome: full.nome, role: full.role };
  }

  // ─── MFA ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/auth/mfa/factors
   * Lista os fatores MFA do usuário autenticado.
   */
  @UseGuards(JwtAuthGuard)
  @Get('mfa/factors')
  async mfaFactors(@CurrentUser() user: CurrentUserPayload) {
    return this.mfaService.listFactors(user.supabaseId);
  }

  /**
   * DELETE /api/auth/mfa/factors/:factorId
   * Remove um fator MFA (admin — reseta MFA do usuário).
   */
  @UseGuards(JwtAuthGuard)
  @Delete('mfa/factors/:factorId')
  @HttpCode(HttpStatus.OK)
  async mfaDeleteFactor(
    @CurrentUser() user: CurrentUserPayload,
    @Param('factorId') factorId: string,
  ) {
    await this.mfaService.deleteFactor(user.supabaseId, factorId);
    return { message: 'Fator MFA removido' };
  }

  /**
   * GET /api/auth/mfa/required
   * Informa se MFA é obrigatório para a role do usuário autenticado.
   */
  @UseGuards(JwtAuthGuard)
  @Get('mfa/required')
  async mfaRequired(@CurrentUser() user: CurrentUserPayload) {
    return {
      required: this.mfaService.roleRequiresMfa(user.role),
      temPrazo: this.mfaService.roleTemPrazoMfa(user.role),
    };
  }
}
