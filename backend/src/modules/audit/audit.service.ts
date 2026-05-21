import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PaginatedResponse,
  paginate,
} from '../../common/dto/paginated-response.dto';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    userId?: number;
    acao: string;
    entidade?: string;
    entidadeId?: number;
    dadosAntes?: Record<string, unknown> | null;
    dadosDepois?: Record<string, unknown>;
    contexto?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    const payload: Prisma.AuditLogUncheckedCreateInput = {
      acao: data.acao,
      userId: data.userId,
      entidade: data.entidade,
      entidadeId: data.entidadeId,
      dadosAntes: (data.dadosAntes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      dadosDepois: (data.dadosDepois ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      contexto: (data.contexto ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ip: data.ip,
      userAgent: data.userAgent,
    };
    await this.prisma.auditLog.create({ data: payload });
  }

  async findAll(filters: {
    page: number;
    limit: number;
    userId?: number;
    entidade?: string;
    acao?: string;
  }): Promise<PaginatedResponse<unknown>> {
    const { page, limit, userId, entidade, acao } = filters;
    const skip = (page - 1) * limit;
    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (entidade) where.entidade = { contains: entidade };
    if (acao) where.acao = { contains: acao };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { nome: true, username: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }
}
