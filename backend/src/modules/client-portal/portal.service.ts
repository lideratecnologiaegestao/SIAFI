import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  QUEUE_FINANCE_NOTIFICATIONS,
  JOB_WA_PORTAL_ATIVADO,
  JOB_EMAIL_PORTAL_ATIVADO,
} from '../queue/queue.constants';
import type { RequestUser } from '../auth/guards/supabase-auth.guard';

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  // ─── Ativar portal ────────────────────────────────────────────────────────

  async ativarPortal(clientId: number, operador: RequestUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, active: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    if (operador.role === 'consultor' && client.consultorId !== operador.id) {
      throw new ForbiddenException('Cliente não pertence à sua carteira.');
    }

    if (!client.email) {
      throw new BadRequestException(
        'Cliente não possui email cadastrado. Atualize o cadastro antes de ativar o portal.',
      );
    }

    // Idempotência — já está ativo?
    if (client.portalAtivo && client.supabaseId) {
      return { sucesso: true, mensagem: 'Portal já estava ativo.', jaAtivo: true };
    }

    const senhaTemporaria = this.gerarSenhaTemporaria();

    // Se já tem supabaseId (portal foi desativado) → reativar + nova senha
    if (client.supabaseId) {
      await this.supabase.admin.auth.admin.updateUserById(client.supabaseId, {
        password: senhaTemporaria,
        ban_duration: 'none',
        app_metadata: { role: 'cliente', clientId: client.id },
      });

      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          portalAtivo: true,
          portalAtivadoEm: new Date(),
          portalAtivadoPor: operador.id,
          senhaTemporaria: true,
          primeiroAcesso: true,
        },
      });

      await this.registrarAudit(operador.id, 'PORTAL_REATIVADO', clientId, { email: client.email });
      await this.enfileirarNotificacoes(client.id, client.nome, client.whatsapp, client.email, senhaTemporaria);

      return {
        sucesso: true,
        senhaTemporaria,
        mensagem: `Portal reativado. Senha enviada para ${client.email}.`,
      };
    }

    // Novo usuário no Supabase Auth
    let supabaseUserId: string | null = null;
    try {
      // Verificar se email já existe no Supabase
      const { data: existingList } = await this.supabase.admin.auth.admin.listUsers();
      const users = (existingList as { users?: { id: string; email?: string }[] } | null)?.users ?? [];
      const existing = users.find(u => u.email === client.email);

      if (existing) {
        supabaseUserId = existing.id;
        await this.supabase.admin.auth.admin.updateUserById(supabaseUserId, {
          password: senhaTemporaria,
          ban_duration: 'none',
          app_metadata: { role: 'cliente', clientId: client.id },
          email_confirm: true,
        });
      } else {
        const { data, error } = await this.supabase.admin.auth.admin.createUser({
          email: client.email,
          password: senhaTemporaria,
          email_confirm: true,
          app_metadata: { role: 'cliente', clientId: client.id },
          user_metadata: { nome: client.nome },
        });
        if (error || !data.user) {
          throw new InternalServerErrorException(error?.message ?? 'Erro ao criar usuário Supabase');
        }
        supabaseUserId = data.user.id;
      }

      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          supabaseId: supabaseUserId,
          portalAtivo: true,
          portalAtivadoEm: new Date(),
          portalAtivadoPor: operador.id,
          senhaTemporaria: true,
          primeiroAcesso: true,
        },
      });
    } catch (err) {
      if (supabaseUserId && !client.supabaseId) {
        await this.supabase.admin.auth.admin.deleteUser(supabaseUserId).catch(() => {});
      }
      throw err;
    }

    await this.registrarAudit(operador.id, 'PORTAL_ATIVADO', clientId, {
      email: client.email,
      ativadoPor: operador.nome,
    });
    await this.enfileirarNotificacoes(client.id, client.nome, client.whatsapp, client.email, senhaTemporaria);

    return {
      sucesso: true,
      senhaTemporaria,
      mensagem: `Portal ativado. Senha enviada via WhatsApp e email para ${client.email}.`,
    };
  }

  // ─── Desativar portal ─────────────────────────────────────────────────────

  async desativarPortal(clientId: number, operador: RequestUser, motivo: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, portalAtivo: true },
    });
    if (!client) throw new NotFoundException('Portal não está ativo.');

    if (client.supabaseId) {
      await this.supabase.admin.auth.admin.updateUserById(client.supabaseId, {
        ban_duration: '87600h',
      });
    }

    await this.prisma.client.update({
      where: { id: clientId },
      data: { portalAtivo: false },
    });

    await this.registrarAudit(operador.id, 'PORTAL_DESATIVADO', clientId, { motivo });

    return { sucesso: true };
  }

  // ─── Reativar portal ──────────────────────────────────────────────────────

  async reativarPortal(clientId: number, operador: RequestUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, portalAtivo: false, supabaseId: { not: null } },
    });
    if (!client) throw new NotFoundException('Portal não encontrado ou já está ativo.');

    await this.supabase.admin.auth.admin.updateUserById(client.supabaseId!, {
      ban_duration: 'none',
    });

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        portalAtivo: true,
        portalAtivadoEm: new Date(),
        portalAtivadoPor: operador.id,
      },
    });

    await this.registrarAudit(operador.id, 'PORTAL_REATIVADO', clientId, {});

    return { sucesso: true, mensagem: 'Portal reativado com sucesso.' };
  }

  // ─── Reenviar senha ───────────────────────────────────────────────────────

  async reenviarSenha(clientId: number, operador: RequestUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, portalAtivo: true, active: true },
    });
    if (!client) throw new NotFoundException('Portal não está ativo.');

    if (operador.role === 'consultor' && client.consultorId !== operador.id) {
      throw new ForbiddenException('Cliente não pertence à sua carteira.');
    }

    if (!client.supabaseId) {
      throw new BadRequestException('Cliente não possui conta Supabase vinculada.');
    }

    const novaSenha = this.gerarSenhaTemporaria();

    await this.supabase.admin.auth.admin.updateUserById(client.supabaseId, {
      password: novaSenha,
    });

    await this.prisma.client.update({
      where: { id: clientId },
      data: { senhaTemporaria: true, primeiroAcesso: true },
    });

    await this.enfileirarNotificacoes(client.id, client.nome, client.whatsapp, client.email, novaSenha, true);

    await this.registrarAudit(operador.id, 'PORTAL_SENHA_REENVIADA', clientId, {});

    return { sucesso: true, mensagem: 'Nova senha enviada ao cliente.' };
  }

  // ─── Status do portal ─────────────────────────────────────────────────────

  async getStatus(clientId: number, operador: RequestUser) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, active: true },
      select: {
        id: true,
        email: true,
        portalAtivo: true,
        portalAtivadoEm: true,
        portalAtivadoPor: true,
        ultimoAcessoPortal: true,
        mfaEnabled: true,
        mfaLoginCount: true,
        senhaTemporaria: true,
        primeiroAcesso: true,
        supabaseId: true,
        consultorId: true,
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    if (operador.role === 'consultor' && client.consultorId !== operador.id) {
      throw new ForbiddenException('Cliente não pertence à sua carteira.');
    }

    return {
      temEmail: !!client.email,
      portalAtivo: client.portalAtivo,
      portalAtivadoEm: client.portalAtivadoEm,
      ultimoAcessoPortal: client.ultimoAcessoPortal,
      mfaEnabled: client.mfaEnabled,
      mfaLoginsRestantes: Math.max(0, 5 - client.mfaLoginCount),
      senhaTemporaria: client.senhaTemporaria,
      primeiroAcesso: client.primeiroAcesso,
      temContaSupabase: !!client.supabaseId,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private gerarSenhaTemporaria(): string {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;
    const bytes = crypto.randomBytes(12);
    let senha = '';
    senha += upper[bytes[0] % upper.length];
    senha += lower[bytes[1] % lower.length];
    senha += digits[bytes[2] % digits.length];
    senha += special[bytes[3] % special.length];
    for (let i = 4; i < 12; i++) {
      senha += all[bytes[i] % all.length];
    }
    // Fisher-Yates com crypto
    const arr = senha.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }

  private async registrarAudit(
    userId: number,
    acao: string,
    clientId: number,
    dados: Record<string, unknown>,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        acao,
        entidade: 'clients',
        entidadeId: clientId,
        dados: dados as any,
      },
    }).catch(() => {});
  }

  private async enfileirarNotificacoes(
    clientId: number,
    nome: string,
    whatsapp: string | null,
    email: string | null,
    senhaTemporaria: string,
    isReenvio = false,
  ) {
    const payload = { clientId, clienteNome: nome, clienteWhatsapp: whatsapp, clienteEmail: email, senhaTemporaria, isReenvio };
    await this.notificationsQueue.add(JOB_WA_PORTAL_ATIVADO, payload).catch(() => {});
    await this.notificationsQueue.add(JOB_EMAIL_PORTAL_ATIVADO, payload).catch(() => {});
  }
}
