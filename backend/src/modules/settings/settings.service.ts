import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CacheEntry {
  valor: string | null;
  expiresAt: number;
}

@Injectable()
export class SettingsService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly TTL_MS = 5 * 60 * 1000; // 5 minutos

  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<unknown> {
    return this.prisma.siteSetting.findMany({ orderBy: { chave: 'asc' } });
  }

  async get(chave: string): Promise<string | null> {
    const cached = this.cache.get(chave);
    if (cached && Date.now() < cached.expiresAt) return cached.valor;

    const s = await this.prisma.siteSetting.findUnique({ where: { chave } });
    const valor = s?.valor ?? null;
    this.cache.set(chave, { valor, expiresAt: Date.now() + this.TTL_MS });
    return valor;
  }

  // Retorna o valor como número; lança se a chave não existir ou não for numérica
  async getNumber(chave: string, fallback?: number): Promise<number> {
    const raw = await this.get(chave);
    const n = parseFloat(raw ?? '');
    if (isNaN(n)) {
      if (fallback !== undefined) return fallback;
      throw new Error(`Setting "${chave}" não encontrado ou não é numérico`);
    }
    return n;
  }

  async set(chave: string, valor: string): Promise<unknown> {
    this.cache.delete(chave);
    return this.prisma.siteSetting.upsert({
      where:  { chave },
      update: { valor },
      create: { chave, valor },
    });
  }

  async setMany(entries: Array<{ chave: string; valor: string }>): Promise<void> {
    await Promise.all(entries.map(e => this.set(e.chave, e.valor)));
  }
}
