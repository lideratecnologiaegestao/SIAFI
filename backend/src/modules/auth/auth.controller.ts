import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, AuthenticatedUser } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * POST /api/auth/login
   * Passport LocalStrategy validates credentials before this handler runs.
   * req.user is populated by LocalStrategy.validate() via AuthService.validateUser().
   */
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Req() req: Request & { user: AuthenticatedUser }, @Res({ passthrough: true }) res: Response) {
    return this.authService.login(req.user, res);
  }

  /**
   * POST /api/auth/refresh
   * Reads the httpOnly cookie refresh_token and issues a new accessToken.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request) {
    const cookies = req.cookies as Record<string, string>;
    const refreshToken: string | undefined = cookies['refresh_token'];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token ausente');
    }
    return this.authService.refresh(refreshToken);
  }

  /**
   * POST /api/auth/logout
   * Requires valid JWT. Deletes the refresh token from DB and clears the cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: { id: number; username: string; role: string },
  ) {
    const cookies = req.cookies as Record<string, string>;
    const refreshToken: string | undefined = cookies['refresh_token'];

    if (refreshToken) {
      await this.authService.logout(user.id, refreshToken);
    }

    res.clearCookie('refresh_token', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });

    return { message: 'Sessão encerrada com sucesso' };
  }

  /**
   * GET /api/auth/me
   * Returns the currently authenticated user from the JWT payload.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: { id: number; username: string; role: string }) {
    const full = await this.usersService.findById(user.id);
    if (!full) throw new NotFoundException('Usuário não encontrado');
    return { id: full.id, username: full.username, nome: full.nome, role: full.role };
  }
}
