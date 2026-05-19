import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import type { Response } from 'express';

export interface AuthenticatedUser {
  id: number;
  username: string;
  nome: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async validateUser(
    username: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.active) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }

    const { password: _pw, ...result } = user;
    return result as AuthenticatedUser;
  }

  async login(
    user: AuthenticatedUser,
    res: Response,
  ): Promise<{ accessToken: string; user: { id: number; nome: string; role: string } }> {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'siafi_jwt_secret_change_in_production',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET ||
        'siafi_jwt_refresh_secret_change_in_production',
      expiresIn: '7d',
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId: user.id,
        expiresAt,
      },
    });

    const maxAge = 7 * 24 * 60 * 60 * 1000;
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        nome: user.nome,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: { sub: number; username: string; role: string };

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret:
          process.env.JWT_REFRESH_SECRET ||
          'siafi_jwt_refresh_secret_change_in_production',
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    const tokenHash = this.hashToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: tokenHash },
    });

    if (!storedToken || storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token não encontrado');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException('Refresh token expirado');
    }

    const newAccessToken = this.jwtService.sign(
      { sub: payload.sub, username: payload.username, role: payload.role },
      {
        secret: process.env.JWT_SECRET || 'siafi_jwt_secret_change_in_production',
        expiresIn: '15m',
      },
    );

    return { accessToken: newAccessToken };
  }

  async logout(userId: number, refreshToken: string): Promise<void> {
    try {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({
        where: {
          token: tokenHash,
          userId,
        },
      });
    } catch {
      throw new InternalServerErrorException('Erro ao encerrar sessão');
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
