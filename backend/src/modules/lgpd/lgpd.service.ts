import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QUEUE_FINANCE_NOTIFICATIONS,
  JOB_LGPD_EXPORTAR_DADOS,
} from '../queue/queue.constants';

const SENSITIVE_FIELDS = [
  'password', 'senha', 'token', 'accesstoken', 'refreshtoken',
  'cpf', 'rg', 'datanascimento', 'fotopath', 'rgpath', 'comprovantepath', 'mfasecret',
];

export function sanitizarDadosAudit(
  dados: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(dados).map(([k, v]) =>
      SENSITIVE_FIELDS.some((s) => k.toLowerCase().includes(s))
        ? [k, '[REDACTED]']
        : [k, v],
    ),
  );
}

@Injectable()
export class LgpdService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS) private readonly notifQueue: Queue,
  ) {}

  // ─── Portal ───────────────────────────────────────────────────────────────

  async registrarConsentimento(
    clientId: number,
    dto: { tipo: string; versao: string; aceito: boolean },
    ip: string,
    userAgent: string,
  ) {
    const timestamp = new Date().toISOString();
    const hash = createHash('sha256')
      .update(`${dto.tipo}|${dto.versao}|${clientId}|${timestamp}`)
      .digest('hex');

    const consent = await this.prisma.consentimentoLGPD.create({
      data: { clientId, tipo: dto.tipo, versao: dto.versao, aceito: dto.aceito, ip, userAgent, hash },
    });

    // Atualizar campos denormalizados no Client
    if (dto.aceito) {
      if (dto.tipo === 'termos_uso') {
        await this.prisma.client.update({
          where: { id: clientId },
          data: { termosAceitosEm: new Date(), termosVersao: dto.versao },
        });
      } else if (dto.tipo === 'politica_privacidade') {
        await this.prisma.client.update({
          where: { id: clientId },
          data: { politicaAceitaEm: new Date() },
        });
      }
    }

    return consent;
  }

  async listarConsentimentos(clientId: number) {
    return this.prisma.consentimentoLGPD.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async criarSolicitacao(
    clientId: number,
    nomeRequerente: string,
    emailRequerente: string,
    dto: { tipo: string; descricao: string },
    ip: string,
  ) {
    return this.prisma.solicitacaoTitular.create({
      data: { clientId, nomeRequerente, emailRequerente, tipo: dto.tipo, descricao: dto.descricao, ip },
    });
  }

  async listarSolicitacoes(clientId: number) {
    return this.prisma.solicitacaoTitular.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMeusDados(clientId: number) {
    const [client, contratos, pagamentos, notificacoes, consentimentos, solicitacoes] =
      await Promise.all([
        this.prisma.client.findUnique({
          where: { id: clientId },
          select: {
            id: true, nome: true, nomeSocial: true, email: true, whatsapp: true,
            telefone: true, endereco: true, bairro: true, cidade: true, estado: true,
            cep: true, createdAt: true, portalAtivadoEm: true, ultimoAcessoPortal: true,
            mfaEnabled: true, notificacoesEmail: true, notificacoesWhatsapp: true,
            termosAceitosEm: true, termosVersao: true, politicaAceitaEm: true,
          },
        }),
        this.prisma.loan.findMany({
          where: { clientId },
          select: { id: true, principalAmount: true, numeroParcelas: true, dataInicio: true, status: true, createdAt: true },
        }),
        this.prisma.payment.findMany({
          where: { installment: { loan: { clientId } } },
          select: { id: true, valorPago: true, dataPagamento: true, metodoPagamento: true, createdAt: true },
          orderBy: { dataPagamento: 'desc' },
          take: 200,
        }),
        this.prisma.notification.findMany({
          where: { clientId },
          select: { id: true, tipo: true, assunto: true, sentAt: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.prisma.consentimentoLGPD.findMany({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.solicitacaoTitular.findMany({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    return {
      exportadoEm: new Date().toISOString(),
      versaoSistema: '2.0',
      titular: { dados_pessoais: client, contratos, pagamentos, notificacoes, consentimentos, solicitacoes },
    };
  }

  async enfileirarExportacao(clientId: number) {
    await this.notifQueue.add(
      JOB_LGPD_EXPORTAR_DADOS,
      { clientId },
      { attempts: 2, removeOnComplete: { count: 50 } },
    );
    return { mensagem: 'Exportação enfileirada. Você receberá os dados por email em até 24 horas.' };
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async listarSolicitacoesAdmin(filtros: {
    status?: string;
    tipo?: string;
    page: number;
    limit: number;
  }) {
    const { status, tipo, page, limit } = filtros;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tipo) where.tipo = tipo;

    const [data, total] = await Promise.all([
      this.prisma.solicitacaoTitular.findMany({
        where,
        include: {
          client: { select: { id: true, nome: true, email: true } },
          respondente: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.solicitacaoTitular.count({ where }),
    ]);

    return { data, total, page, lastPage: Math.ceil(total / limit) };
  }

  async getSolicitacaoDetalhe(id: number) {
    const sol = await this.prisma.solicitacaoTitular.findUnique({
      where: { id },
      include: {
        client: true,
        respondente: { select: { id: true, nome: true } },
      },
    });
    if (!sol) throw new NotFoundException('Solicitação não encontrada');
    return sol;
  }

  async responderSolicitacao(
    id: number,
    dto: { resposta: string; status: 'concluido' | 'negado' },
    adminId: number,
  ) {
    return this.prisma.solicitacaoTitular.update({
      where: { id },
      data: { resposta: dto.resposta, status: dto.status, respondidoEm: new Date(), respondidoPor: adminId },
    });
  }

  async relatorioConsentimentos() {
    const tipos = [
      'termos_uso', 'politica_privacidade', 'cookies_analiticos',
      'marketing_whatsapp', 'marketing_email',
    ];
    return Promise.all(
      tipos.map(async (tipo) => {
        const [aceitos, revogados] = await Promise.all([
          this.prisma.consentimentoLGPD.count({ where: { tipo, aceito: true } }),
          this.prisma.consentimentoLGPD.count({ where: { tipo, aceito: false } }),
        ]);
        return { tipo, aceitos, revogados };
      }),
    );
  }

  async anonimizarCliente(clientId: number, adminId: number) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        active: true,
        loans: {
          where: { status: { in: ['ativo', 'inadimplente', 'aguardando_aceite', 'aguardando_liberacao'] } },
          select: { id: true },
        },
      },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado');
    if (client.loans.length > 0) {
      throw new ForbiddenException('Não é possível anonimizar cliente com contratos ativos');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: {
          nome: `Cliente Anonimizado #${clientId}`,
          cpf: null,
          rg: null,
          dataNascimento: null,
          email: `anonimizado_${clientId}_${Date.now()}@anonimizado.local`,
          whatsapp: null,
          telefone: null,
          endereco: null,
          bairro: null,
          cidade: null,
          estado: null,
          cep: null,
          fotoPath: null,
          rgPath: null,
          comprovantePath: null,
          observacoes: 'DADOS ANONIMIZADOS EM CUMPRIMENTO À LGPD',
          active: false,
          portalAtivo: false,
          anonimizadoEm: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminId,
          acao: 'DADOS_ANONIMIZADOS',
          entidade: 'clients',
          entidadeId: clientId,
          dados: { motivo: 'Solicitação LGPD — direito ao esquecimento' } as any,
        },
      });
    });
  }
}
