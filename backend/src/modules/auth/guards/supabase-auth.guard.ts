import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SupabaseService } from '../../../supabase/supabase.service';

export interface RequestUser {
  id: number;
  supabaseId: string;
  username: string;
  nome: string;
  role: string;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('Token não fornecido');

    const { data: { user }, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !user) throw new UnauthorizedException('Token inválido ou expirado');

    // Decode JWT to check aal (Authentication Assurance Level) without extra round-trip
    const aal = this.extractAal(token);
    const role = (user.app_metadata?.role as string) || '';
    const prismaId = user.app_metadata?.prismaId as number | undefined;

    if (prismaId && role) {
      // Fast path: all data in JWT claims, no DB lookup needed
      req.user = {
        id: prismaId,
        supabaseId: user.id,
        username: (user.user_metadata?.username as string) || '',
        nome: (user.user_metadata?.nome as string) || '',
        role,
        aal,
      } satisfies RequestUser & { aal: string };
    } else {
      // Fallback: user not yet synced — look up by supabaseId
      const dbUser = await this.prisma.user.findFirst({
        where: { supabaseId: user.id },
        select: { id: true, username: true, nome: true, role: true, active: true },
      });
      if (!dbUser || !dbUser.active) {
        throw new UnauthorizedException('Usuário não encontrado ou inativo');
      }
      req.user = {
        id: dbUser.id,
        supabaseId: user.id,
        username: dbUser.username,
        nome: dbUser.nome,
        role: dbUser.role,
        aal,
      };
    }

    // Enforce MFA for admin and financeiro
    const mfaRequired = ['admin', 'financeiro'].includes(req.user.role);
    if (mfaRequired && aal !== 'aal2') {
      const hasMfaFactor = user.factors?.some((f: { status: string }) => f.status === 'verified');
      if (hasMfaFactor) {
        throw new UnauthorizedException('MFA obrigatório — complete o desafio TOTP');
      }
    }

    return true;
  }

  private extractToken(req: { headers?: { authorization?: string } }): string | null {
    const auth = req.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    return auth.slice(7);
  }

  private extractAal(token: string): string {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString(),
      );
      return (payload.aal as string) || 'aal1';
    } catch {
      return 'aal1';
    }
  }
}
