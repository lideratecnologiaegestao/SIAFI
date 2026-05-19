import { Injectable, NotFoundException } from '@nestjs/common';
import { Client, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginatedResponse, paginate } from '../../common/dto/paginated-response.dto';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientFilterDto } from './dto/client-filter.dto';

export interface UploadedFiles {
  foto?: Express.Multer.File[];
  rg?: Express.Multer.File[];
  comprovante?: Express.Multer.File[];
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: ClientFilterDto): Promise<PaginatedResponse<Client>> {
    const { page, limit, search, status } = filters;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (status === 'active') {
      where.active = true;
    } else if (status === 'inactive') {
      where.active = false;
    }

    if (search) {
      where.OR = [
        { nome: { contains: search } },
        { cpf: { contains: search } },
        { whatsapp: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    return paginate(data, total, page, limit);
  }

  async findById(id: number): Promise<Client> {
    const client = await this.prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Cliente com id ${id} não encontrado`);
    }
    return client;
  }

  async create(dto: CreateClientDto, files?: UploadedFiles): Promise<Client> {
    const filePaths = this.extractFilePaths(files);

    const data: Prisma.ClientCreateInput = {
      nome: dto.nome,
      cpf: dto.cpf ?? null,
      rg: dto.rg ?? null,
      dataNascimento: dto.dataNascimento ? new Date(dto.dataNascimento) : null,
      email: dto.email ?? null,
      whatsapp: dto.whatsapp ?? null,
      telefone: dto.telefone ?? null,
      endereco: dto.endereco ?? null,
      bairro: dto.bairro ?? null,
      cidade: dto.cidade ?? null,
      estado: dto.estado ?? null,
      cep: dto.cep ?? null,
      observacoes: dto.observacoes ?? null,
      notificacoesEmail: dto.notificacoesEmail ?? true,
      ...filePaths,
    };

    return this.prisma.client.create({ data });
  }

  async update(id: number, dto: UpdateClientDto, files?: UploadedFiles): Promise<Client> {
    await this.findById(id);

    const filePaths = this.extractFilePaths(files);

    const data: Record<string, unknown> = { ...filePaths };

    if (dto.nome !== undefined) data.nome = dto.nome;
    if (dto.cpf !== undefined) data.cpf = dto.cpf;
    if (dto.rg !== undefined) data.rg = dto.rg;
    if (dto.dataNascimento !== undefined) data.dataNascimento = new Date(dto.dataNascimento);
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.whatsapp !== undefined) data.whatsapp = dto.whatsapp;
    if (dto.telefone !== undefined) data.telefone = dto.telefone;
    if (dto.endereco !== undefined) data.endereco = dto.endereco;
    if (dto.bairro !== undefined) data.bairro = dto.bairro;
    if (dto.cidade !== undefined) data.cidade = dto.cidade;
    if (dto.estado !== undefined) data.estado = dto.estado;
    if (dto.cep !== undefined) data.cep = dto.cep;
    if (dto.observacoes !== undefined) data.observacoes = dto.observacoes;
    if (dto.notificacoesEmail !== undefined) data.notificacoesEmail = dto.notificacoesEmail;

    return this.prisma.client.update({ where: { id }, data });
  }

  async softDelete(id: number): Promise<void> {
    await this.findById(id);
    await this.prisma.client.update({
      where: { id },
      data: { active: false },
    });
  }

  async getStats(): Promise<{ total: number; ativos: number; inativos: number; quitados: number; atrasados: number }> {
    const [total, ativos, quitados, atrasados] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { active: true } }),
      this.prisma.client.count({
        where: { loans: { some: { status: 'quitado' } } },
      }),
      this.prisma.client.count({
        where: {
          loans: { some: { installments: { some: { status: 'atrasado' } } } },
        },
      }),
    ]);

    return { total, ativos, inativos: total - ativos, quitados, atrasados };
  }

  async findQuitados(): Promise<unknown[]> {
    return this.prisma.client.findMany({
      where: { loans: { some: { status: 'quitado' } } },
      select: { id: true, nome: true, cpf: true },
      orderBy: { nome: 'asc' },
    });
  }

  private extractFilePaths(files?: UploadedFiles): {
    fotoPath?: string;
    rgPath?: string;
    comprovantePath?: string;
  } {
    const paths: { fotoPath?: string; rgPath?: string; comprovantePath?: string } = {};

    if (files?.foto?.[0]) {
      paths.fotoPath = `uploads/clients/${files.foto[0].filename}`;
    }
    if (files?.rg?.[0]) {
      paths.rgPath = `uploads/clients/${files.rg[0].filename}`;
    }
    if (files?.comprovante?.[0]) {
      paths.comprovantePath = `uploads/clients/${files.comprovante[0].filename}`;
    }

    return paths;
  }
}
