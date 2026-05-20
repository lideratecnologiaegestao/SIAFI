import {
  Controller,
  Post,
  Get,
  Delete,
  Req,
  Res,
  Body,
  Param,
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
   * Validates credentials locally, then authenticates via Supabase Auth.
   * Returns Supabase access_token + sets refresh_token as httpOnly cookie.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(body.username, body.password, res);
  }

  /**
   * POST /api/auth/refresh
   * Uses Supabase to refresh the session from the httpOnly cookie.
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
   * Revokes the Supabase session and clears the cookie.
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
   * Returns the current user from Prisma (full data).
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: CurrentUserPayload) {
    const full = await this.usersService.findById(user.id);
    if (!full) throw new NotFoundException('Usuário não encontrado');
    return { id: full.id, username: full.username, nome: full.nome, role: full.role };
  }

  // ─── MFA ─────────────────────────────────────────────────────────────────────

  /**
   * GET /api/auth/mfa/factors
   * Lists the authenticated user's MFA factors.
   */
  @UseGuards(JwtAuthGuard)
  @Get('mfa/factors')
  async mfaFactors(@CurrentUser() user: CurrentUserPayload) {
    return this.mfaService.listFactors(user.supabaseId);
  }

  /**
   * DELETE /api/auth/mfa/factors/:factorId
   * Removes an MFA factor (admin action — resets MFA for the user).
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
   * Returns whether MFA is required for the authenticated user's role.
   */
  @UseGuards(JwtAuthGuard)
  @Get('mfa/required')
  async mfaRequired(@CurrentUser() user: CurrentUserPayload) {
    return { required: this.mfaService.roleRequiresMfa(user.role) };
  }
}
