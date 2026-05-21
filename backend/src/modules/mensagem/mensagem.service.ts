import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CriarConversaDto } from './dto/criar-conversa.dto';
import { EnviarMensagemDto } from './dto/enviar-mensagem.dto';

@Injectable()
export class MensagemService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Conversas ───────────────────────────────────────────────────────────────

  async findConversas(userId: number): Promise<unknown[]> {
    const participacoes = await this.prisma.conversaParticipante.findMany({
      where:   { userId },
      include: {
        conversa: {
          include: {
            participantes: {
              include: { user: { select: { id: true, nome: true, role: true } } },
            },
            mensagens: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { conversa: { updatedAt: 'desc' } },
    });

    return Promise.all(participacoes.map(async (p) => {
      const naoLidas = await this.prisma.mensagem.count({
        where: {
          conversaId:  p.conversaId,
          remetenteId: { not: userId },
          createdAt:   p.ultimaLeitura ? { gt: p.ultimaLeitura } : undefined,
        },
      });
      return { ...p.conversa, naoLidas, minhaultimaLeitura: p.ultimaLeitura };
    }));
  }

  async contarNaoLidas(userId: number): Promise<number> {
    const participacoes = await this.prisma.conversaParticipante.findMany({
      where:  { userId },
      select: { conversaId: true, ultimaLeitura: true },
    });

    let total = 0;
    for (const p of participacoes) {
      const count = await this.prisma.mensagem.count({
        where: {
          conversaId:  p.conversaId,
          remetenteId: { not: userId },
          createdAt:   p.ultimaLeitura ? { gt: p.ultimaLeitura } : undefined,
        },
      });
      total += count;
    }
    return total;
  }

  async criarConversa(dto: CriarConversaDto, userId: number): Promise<unknown> {
    if (!dto.targetUserId && !dto.titulo) {
      throw new BadRequestException('Informe targetUserId ou titulo');
    }

    // Conversa direta: verificar se já existe
    if (dto.targetUserId) {
      const existing = await this.prisma.conversaParticipante.findFirst({
        where: {
          userId,
          conversa: {
            tipo: 'direto',
            participantes: { some: { userId: dto.targetUserId } },
          },
        },
        select: { conversaId: true },
      });
      if (existing) {
        return this.prisma.conversa.findUnique({
          where: { id: existing.conversaId },
          include: { participantes: { include: { user: { select: { id: true, nome: true, role: true } } } } },
        });
      }

      const target = await this.prisma.user.findUnique({ where: { id: dto.targetUserId }, select: { id: true, nome: true } });
      if (!target) throw new NotFoundException(`Usuário ${dto.targetUserId} não encontrado`);
      const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { nome: true } });

      return this.prisma.$transaction(async (tx) => {
        const conversa = await tx.conversa.create({
          data: { tipo: 'direto', titulo: `${me?.nome ?? 'Eu'} & ${target.nome}` },
        });
        await tx.conversaParticipante.createMany({
          data: [
            { conversaId: conversa.id, userId,              role: 'membro' },
            { conversaId: conversa.id, userId: dto.targetUserId!, role: 'membro' },
          ],
        });
        return conversa;
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const conversa = await tx.conversa.create({
        data: { tipo: 'grupo', titulo: dto.titulo },
      });
      await tx.conversaParticipante.create({
        data: { conversaId: conversa.id, userId, role: 'admin' },
      });
      return conversa;
    });
  }

  // ─── Mensagens ───────────────────────────────────────────────────────────────

  async findMensagens(conversaId: number, userId: number): Promise<unknown[]> {
    // Verificar participação
    const participacao = await this.prisma.conversaParticipante.findUnique({
      where: { conversaId_userId: { conversaId, userId } },
    });
    if (!participacao) throw new ForbiddenException('Você não participa desta conversa');

    // Marcar como lida (atualizar ultimaLeitura)
    await this.prisma.conversaParticipante.update({
      where: { conversaId_userId: { conversaId, userId } },
      data:  { ultimaLeitura: new Date() },
    });

    return this.prisma.mensagem.findMany({
      where:   { conversaId },
      include: { remetente: { select: { id: true, nome: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      take:    200,
    });
  }

  async enviar(conversaId: number, dto: EnviarMensagemDto, userId: number): Promise<unknown> {
    const participacao = await this.prisma.conversaParticipante.findUnique({
      where: { conversaId_userId: { conversaId, userId } },
    });
    if (!participacao) throw new ForbiddenException('Você não participa desta conversa');

    const [mensagem] = await this.prisma.$transaction([
      this.prisma.mensagem.create({
        data: {
          conversaId,
          remetenteId: userId,
          conteudo:    dto.conteudo,
          tipo:        dto.tipo ?? 'texto',
        },
        include: { remetente: { select: { id: true, nome: true, role: true } } },
      }),
      // Atualizar updatedAt da conversa para ordenação
      this.prisma.conversa.update({
        where: { id: conversaId },
        data:  { updatedAt: new Date() },
      }),
    ]);

    return mensagem;
  }

  async adicionarParticipante(conversaId: number, targetUserId: number, userId: number): Promise<unknown> {
    const participacao = await this.prisma.conversaParticipante.findUnique({
      where: { conversaId_userId: { conversaId, userId } },
    });
    if (!participacao) throw new ForbiddenException('Você não participa desta conversa');

    return this.prisma.conversaParticipante.upsert({
      where:  { conversaId_userId: { conversaId, userId: targetUserId } },
      create: { conversaId, userId: targetUserId, role: 'membro' },
      update: {},
    });
  }
}
