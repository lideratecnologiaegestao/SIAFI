import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { LoansService } from '../loans/loans.service';
import {
  QUEUE_FINANCE_NOTIFICATIONS,
  JOB_INTENCAO_NOVA,
  JOB_INTENCAO_APROVADA,
  JOB_INTENCAO_REJEITADA,
} from '../queue/queue.constants';
import type { NotificationJobData } from '../queue/queue.interfaces';
import { CreateIntencaoDto } from './dto/create-intencao.dto';
import { AprovarIntencaoDto } from './dto/aprovar-intencao.dto';
import { RejeitarIntencaoDto } from './dto/rejeitar-intencao.dto';
import { FeedbackIntencaoDto } from './dto/feedback-intencao.dto';

const INCLUDE_DETAIL = {
  client: {
    select: {
      id: true, nome: true, nomeSocial: true, cpf: true,
      whatsapp: true, email: true, portalAtivo: true,
      scoreRisco: {
        select: { scoreGeral: true, classificacao: true, calculadoEm: true },
      },
    },
  },
  consultor: { select: { id: true, nome: true } },
  conversas: { select: { id: true, titulo: true, createdAt: true } },
} as const;

@Injectable()
export class IntencaoService {
  private readonly logger = new Logger(IntencaoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly loansService: LoansService,
    @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS)
    private readonly queue: Queue<NotificationJobData>,
  ) {}

  async criar(dto: CreateIntencaoDto, consultorId: number): Promise<unknown> {
    const [client, prazoHoras] = await Promise.all([
      this.prisma.client.findUnique({ where: { id: dto.clientId } }),
      this.settings.getNumber('intencao.prazo_analise_horas', 24),
    ]);

    if (!client) throw new NotFoundException(`Cliente ${dto.clientId} não encontrado`);
    if (!client.active) throw new BadRequestException('Cliente inativo');

    const prazoExpiracaoEm = new Date(Date.now() + prazoHoras * 3_600_000);

    const intencao = await this.prisma.$transaction(async (tx) => {
      const created = await tx.intencaoEmprestimo.create({
        data: {
          clientId:        dto.clientId,
          consultorId,
          valorSolicitado: dto.valorSolicitado,
          numeroParcelas:  dto.numeroParcelas,
          finalidade:      dto.finalidade ?? null,
          observacoes:     dto.observacoes ?? null,
          prazoAnaliseHoras: prazoHoras,
          prazoExpiracaoEm,
          status: 'aguardando',
        },
      });

      const conversa = await tx.conversa.create({
        data: {
          intencaoId: created.id,
          tipo:       'intencao',
          titulo:     `Intenção #${created.id} — ${client.nome}`,
        },
      });

      await tx.conversaParticipante.create({
        data: { conversaId: conversa.id, userId: consultorId, role: 'consultor' },
      });

      return created;
    });

    // Notificar financeiros (fire-and-forget)
    void this.notificarFinanceiros(intencao.id, client.nome, client.whatsapp ?? undefined);

    return intencao;
  }

  async findAll(opts: { status?: string; consultorId?: number } = {}): Promise<unknown[]> {
    return this.prisma.intencaoEmprestimo.findMany({
      where: {
        ...(opts.status    ? { status: opts.status }       : {}),
        ...(opts.consultorId ? { consultorId: opts.consultorId } : {}),
      },
      include: INCLUDE_DETAIL,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findById(id: number): Promise<unknown> {
    const intencao = await this.prisma.intencaoEmprestimo.findUnique({
      where: { id },
      include: INCLUDE_DETAIL,
    });
    if (!intencao) throw new NotFoundException(`Intenção ${id} não encontrada`);
    return intencao;
  }

  async aprovar(id: number, dto: AprovarIntencaoDto, userId: number): Promise<unknown> {
    const intencao = await this.prisma.intencaoEmprestimo.findUnique({
      where: { id },
      include: { client: { select: { id: true, nome: true, active: true, portalAtivo: true, whatsapp: true, email: true } } },
    });

    if (!intencao) throw new NotFoundException(`Intenção ${id} não encontrada`);
    if (intencao.status !== 'aguardando') {
      throw new BadRequestException(`Intenção já está com status "${intencao.status}"`);
    }

    const slaDias = await this.settings.getNumber('financeiro.sla_aceite_dias', 7);
    const aceiteExpiraEm = new Date(Date.now() + slaDias * 86_400_000);

    const loan = await this.loansService.create(
      {
        clientId:        intencao.clientId,
        principalAmount: dto.principalAmount,
        targetProfit:    dto.targetProfit,
        numeroParcelas:  dto.numeroParcelas,
        dataInicio:      dto.dataInicio,  // provisória — será reajustada em liberarCapital
        metodoPagamento: dto.metodoPagamento,
        observacoes:     dto.observacoes,
      },
      {
        userId:         intencao.consultorId ?? undefined,
        loanStatus:     'aguardando_aceite',
        aceiteExpiraEm,
      },
    ) as { id: number };

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.intencaoEmprestimo.update({
        where: { id },
        data: { status: 'aprovado', loanId: loan.id, aprovadoPor: userId, aprovadoEm: now },
      });

      if (!intencao.client.portalAtivo) {
        await tx.client.update({
          where: { id: intencao.clientId },
          data: { portalAtivo: true, portalAtivadoEm: now, portalAtivadoPor: userId },
        });
      }
    });

    void this.queue.add(JOB_INTENCAO_APROVADA, {
      clientId:        intencao.clientId,
      clienteNome:     intencao.client.nome,
      clienteWhatsapp: intencao.client.whatsapp ?? undefined,
      clienteEmail:    intencao.client.email ?? undefined,
      loanId:          loan.id,
      templateVars:    { intencaoId: String(id), loanId: String(loan.id) },
    });

    return { message: 'Intenção aprovada com sucesso', loanId: loan.id };
  }

  async rejeitar(id: number, dto: RejeitarIntencaoDto, userId: number): Promise<unknown> {
    const intencao = await this.prisma.intencaoEmprestimo.findUnique({
      where: { id },
      include: { client: { select: { nome: true, whatsapp: true, email: true } } },
    });

    if (!intencao) throw new NotFoundException(`Intenção ${id} não encontrada`);
    if (intencao.status !== 'aguardando') {
      throw new BadRequestException(`Intenção já está com status "${intencao.status}"`);
    }

    await this.prisma.intencaoEmprestimo.update({
      where: { id },
      data: {
        status:            'rejeitado',
        motivoRejeicaoTipo: dto.motivoTipo,
        motivoRejeicao:    dto.motivo ?? null,
        aprovadoPor:       userId,
        aprovadoEm:        new Date(),
      },
    });

    void this.queue.add(JOB_INTENCAO_REJEITADA, {
      clientId:        intencao.clientId,
      clienteNome:     intencao.client.nome,
      clienteWhatsapp: intencao.client.whatsapp ?? undefined,
      clienteEmail:    intencao.client.email ?? undefined,
      templateVars:    { motivoTipo: dto.motivoTipo, intencaoId: String(id) },
    });

    return { message: 'Intenção rejeitada' };
  }

  async registrarFeedback(id: number, dto: FeedbackIntencaoDto, userId: number): Promise<unknown> {
    const intencao = await this.prisma.intencaoEmprestimo.findUnique({ where: { id } });
    if (!intencao) throw new NotFoundException(`Intenção ${id} não encontrada`);

    return this.prisma.intencaoEmprestimo.update({
      where: { id },
      data: { feedbackEnviadoEm: new Date(), feedbackEnviadoPor: userId, feedbackCanal: dto.canal },
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async notificarFinanceiros(intencaoId: number, clienteNome: string, whatsapp?: string): Promise<void> {
    try {
      const financeiros = await this.prisma.user.findMany({
        where: { role: { in: ['admin', 'financeiro'] }, active: true },
        select: { id: true },
      });

      for (const user of financeiros) {
        await this.queue.add(JOB_INTENCAO_NOVA, {
          clientId:    0,
          clienteNome,
          clienteWhatsapp: whatsapp,
          templateVars: { intencaoId: String(intencaoId), userId: String(user.id) },
        }, { jobId: `intencao-nova-${intencaoId}-u${user.id}` });
      }
    } catch (err: unknown) {
      this.logger.warn(`Falha ao notificar financeiros para intenção ${intencaoId}: ${String(err)}`);
    }
  }
}
