import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';

export interface AuthenticatedUser {
  id: number;
  username: string;
  nome: string;
  role: string;
}

export interface CreateOperatorDto {
  nome: string;
  username: string;
  password: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

  // ─── Validate (used by LocalStrategy) ────────────────────────────────────────

  async validateUser(username: string, password: string): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.active) return null;
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return null;
    const { password: _pw, ...result } = user;
    return result as AuthenticatedUser;
  }

  // ─── Login ────────────────────────────────────────────────────────────────────

  async login(
    username: string,
    password: string,
    res: Response,
  ): Promise<{
    accessToken: string;
    user: { id: number; nome: string; role: string };
    needsMfa?: boolean;
  }> {
    // 1. Validate locally (bcrypt) to ensure credentials are correct
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const email = this.toSupabaseEmail(username);

    // 2. Auto-sync user to Supabase Auth on first login
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.supabaseId) {
      await this.syncToSupabase(user, password, email);
    }

    // 3. Sign in with Supabase to get session tokens
    const { data, error } = await this.supabase.admin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      throw new UnauthorizedException('Falha na autenticação Supabase');
    }

    const { access_token, refresh_token } = data.session;

    // 4. Set Supabase refresh token as httpOnly cookie
    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    // 5. Determine if MFA challenge is still required
    const aal = this.extractAal(access_token);
    const hasMfaEnabled = data.session.user?.factors?.some(
      (f: { status: string }) => f.status === 'verified',
    );
    const needsMfa =
      ['admin', 'financeiro'].includes(user.role) && hasMfaEnabled && aal !== 'aal2';

    return {
      accessToken: access_token,
      user: { id: user.id, nome: user.nome, role: user.role },
      ...(needsMfa ? { needsMfa: true } : {}),
    };
  }

  // ─── Refresh ──────────────────────────────────────────────────────────────────

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const { data, error } = await this.supabase.admin.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
    return { accessToken: data.session.access_token };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────

  async logout(supabaseId: string): Promise<void> {
    try {
      await this.supabase.admin.auth.admin.signOut(supabaseId, 'local');
    } catch {
      // Best-effort — client removes cookie regardless
    }
  }

  // ─── Create Operator ──────────────────────────────────────────────────────────

  async createOperator(dto: CreateOperatorDto): Promise<{
    id: number;
    username: string;
    nome: string;
    role: UserRole;
  }> {
    const email = this.toSupabaseEmail(dto.username);

    // Check if username already exists in Prisma
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) throw new ConflictException('Username já está em uso');

    // Create in Supabase Auth
    const { data: authData, error } = await this.supabase.admin.auth.admin.createUser({
      email,
      password: dto.password,
      email_confirm: true,
      app_metadata: { role: dto.role },
      user_metadata: { nome: dto.nome, username: dto.username },
    });

    if (error) {
      throw new InternalServerErrorException(`Erro Supabase: ${error.message}`);
    }

    const supabaseId = authData.user.id;

    // Create in Prisma with supabaseId
    const hashedPw = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        nome: dto.nome,
        username: dto.username,
        password: hashedPw,
        role: dto.role,
        supabaseId,
      },
    });

    // Set prismaId in app_metadata for zero-latency guard lookups
    await this.supabase.admin.auth.admin.updateUserById(supabaseId, {
      app_metadata: { role: dto.role, prismaId: user.id },
    });

    return { id: user.id, username: user.username, nome: user.nome, role: user.role };
  }

  // ─── Sync Role ────────────────────────────────────────────────────────────────

  async syncRole(supabaseId: string, role: UserRole): Promise<void> {
    await this.supabase.admin.auth.admin.updateUserById(supabaseId, {
      app_metadata: { role },
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private toSupabaseEmail(username: string): string {
    return `${username}@siafi.local`;
  }

  private extractAal(token: string): string {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      return (payload.aal as string) || 'aal1';
    } catch {
      return 'aal1';
    }
  }

  private async syncToSupabase(
    user: AuthenticatedUser,
    rawPassword: string,
    email: string,
  ): Promise<void> {
    // Check if Supabase account exists with this email
    const { data: listData } = await this.supabase.admin.auth.admin.listUsers();
    const users = (listData as { users?: { id: string; email?: string }[] } | null)?.users ?? [];
    const existing = users.find((u) => u.email === email);

    let supabaseId: string;

    if (existing) {
      supabaseId = existing.id;
      await this.supabase.admin.auth.admin.updateUserById(supabaseId, {
        password: rawPassword,
        app_metadata: { role: user.role, prismaId: user.id },
        user_metadata: { nome: user.nome, username: user.username },
      });
    } else {
      const { data, error } = await this.supabase.admin.auth.admin.createUser({
        email,
        password: rawPassword,
        email_confirm: true,
        app_metadata: { role: user.role, prismaId: user.id },
        user_metadata: { nome: user.nome, username: user.username },
      });
      if (error || !data.user) {
        throw new InternalServerErrorException(`Sync Supabase falhou: ${error?.message}`);
      }
      supabaseId = data.user.id;
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { supabaseId } });
  }
}
