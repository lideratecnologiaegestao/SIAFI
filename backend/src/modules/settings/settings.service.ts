import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<unknown> {
    return this.prisma.siteSetting.findMany({ orderBy: { chave: 'asc' } });
  }

  async get(chave: string): Promise<string | null> {
    const s = await this.prisma.siteSetting.findUnique({ where: { chave } });
    return s?.valor ?? null;
  }

  async set(chave: string, valor: string): Promise<unknown> {
    return this.prisma.siteSetting.upsert({
      where: { chave },
      update: { valor },
      create: { chave, valor },
    });
  }

  async setMany(
    entries: Array<{ chave: string; valor: string }>,
  ): Promise<void> {
    await Promise.all(entries.map((e) => this.set(e.chave, e.valor)));
  }
}
