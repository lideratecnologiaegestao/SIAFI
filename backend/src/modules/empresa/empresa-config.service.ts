import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface EmpresaConfig {
  nome:                string
  nomeFantasia:        string
  cnpj:                string
  inscricaoEstadual:   string
  email:               string
  emailFinanceiro:     string
  telefone:            string
  whatsapp:            string
  site:                string
  logradouro:          string
  numero:              string
  complemento:         string
  bairro:              string
  cidade:              string
  estado:              string
  cep:                 string
  logoUrl:             string
  logoBase64:          string
  faviconUrl:          string
  corPrimaria:         string
  corSecundaria:       string
  corAcento:           string
  corTexto:            string
  corFundo:            string
  rodapePdf:           string
  clausulasAdicionais: string
}

@Injectable()
export class EmpresaConfigService {
  private cache: { data: EmpresaConfig; at: number } | null = null
  private readonly TTL_MS = 5 * 60 * 1000

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<EmpresaConfig> {
    if (this.cache && Date.now() - this.cache.at < this.TTL_MS) {
      return this.cache.data
    }

    const rows = await this.prisma.siteSetting.findMany({
      where: { chave: { startsWith: 'empresa.' } },
    })

    const map: Record<string, string> = {}
    for (const row of rows) {
      map[row.chave.replace('empresa.', '')] = row.valor ?? ''
    }

    const data: EmpresaConfig = {
      nome:                map['nome']               ?? 'SIAFI',
      nomeFantasia:        map['nomeFantasia']        ?? map['nome'] ?? 'SIAFI',
      cnpj:                map['cnpj']               ?? '',
      inscricaoEstadual:   map['inscricaoEstadual']   ?? '',
      email:               map['email']               ?? '',
      emailFinanceiro:     map['emailFinanceiro']     ?? map['email'] ?? '',
      telefone:            map['telefone']            ?? '',
      whatsapp:            map['whatsapp']            ?? '',
      site:                map['site']               ?? '',
      logradouro:          map['logradouro']          ?? '',
      numero:              map['numero']              ?? '',
      complemento:         map['complemento']         ?? '',
      bairro:              map['bairro']              ?? '',
      cidade:              map['cidade']              ?? '',
      estado:              map['estado']              ?? '',
      cep:                 map['cep']                 ?? '',
      logoUrl:             map['logoUrl']             ?? '',
      logoBase64:          map['logoBase64']          ?? '',
      faviconUrl:          map['faviconUrl']          ?? '',
      corPrimaria:        map['corPrimaria']         ?? '#185FA5',
      corSecundaria:      map['corSecundaria']       ?? '#0F6E56',
      corAcento:          map['corAcento']           ?? '#854F0B',
      corTexto:           map['corTexto']            ?? '#1a1a18',
      corFundo:           map['corFundo']            ?? '#f5f5f3',
      rodapePdf:          map['rodapePdf']           ?? '',
      clausulasAdicionais: map['clausulasAdicionais'] ?? '',
    }

    this.cache = { data, at: Date.now() }
    return data
  }

  invalidarCache(): void {
    this.cache = null
  }

  async getRodapePdf(): Promise<string> {
    const e = await this.get()
    if (e.rodapePdf) return e.rodapePdf

    const partes: string[] = []
    const nomeDisplay = e.nomeFantasia || e.nome
    if (nomeDisplay)  partes.push(nomeDisplay)
    if (e.cnpj)       partes.push(`CNPJ: ${e.cnpj}`)

    const endParts = [e.logradouro, e.numero, e.bairro, [e.cidade, e.estado].filter(Boolean).join('/')].filter(Boolean)
    if (endParts.length) partes.push(endParts.join(', '))

    if (e.telefone)   partes.push(`Tel: ${e.telefone}`)
    if (e.email)      partes.push(e.email)
    if (e.site)       partes.push(e.site)

    return partes.join('  ·  ')
  }
}
