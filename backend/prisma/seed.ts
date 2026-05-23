/**
 * Seed padrão SIAFI 2.0 — cria operadores e clientes de demonstração.
 *
 * Uso:
 *   cd backend
 *   npx ts-node --project tsconfig.json --transpile-only prisma/seed.ts
 *
 * Idempotente: operadores pulam se username já existe; clientes fazem upsert por CPF.
 */

import * as dotenv from 'dotenv'
dotenv.config()

import { PrismaClient, GenderIdentity } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const PASSWORD = 'Siafi@1234'

function toSupabaseEmail(username: string): string {
  return `${username}@siafi.local`
}

function formatCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return phone
}

function parseDate(ddmmyyyy: string): Date {
  const [dd, mm, yyyy] = ddmmyyyy.split('/')
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd))
}

// ─── Operadores ───────────────────────────────────────────────────────────────

async function createOperator(params: {
  nome: string
  username: string
  email: string
  role: 'admin' | 'financeiro' | 'caixa' | 'consultor'
}) {
  const { nome, username, email, role } = params

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    console.log(`  [skip] operador "${username}" já existe`)
    return
  }

  const supabaseEmail = toSupabaseEmail(username)

  const { data: authData, error } = await supabase.auth.admin.createUser({
    email: supabaseEmail,
    password: PASSWORD,
    email_confirm: true,
    app_metadata: { role },
    user_metadata: { nome, username },
  })

  let supabaseId: string

  if (error) {
    if (error.message?.includes('already been registered')) {
      const { data: listData } = await supabase.auth.admin.listUsers()
      const users = (listData as any)?.users ?? []
      const found = users.find((u: any) => u.email === supabaseEmail)
      if (!found) { console.error(`  [erro] Supabase: ${error.message}`); return }
      supabaseId = found.id
    } else {
      console.error(`  [erro] Supabase createUser: ${error.message}`); return
    }
  } else {
    supabaseId = authData.user.id
  }

  const hashedPw = await bcrypt.hash(PASSWORD, 12)
  const user = await prisma.user.create({
    data: { nome, username, email, password: hashedPw, role, supabaseId },
  })

  await supabase.auth.admin.updateUserById(supabaseId, {
    app_metadata: { role, prismaId: user.id },
  })

  console.log(`  [ok] operador "${username}" (${role}) criado — id ${user.id}`)
}

// ─── Clientes ─────────────────────────────────────────────────────────────────

interface ClientData {
  nome: string
  cpf: string
  rg: string
  dataNasc: string
  genero: GenderIdentity
  email: string
  cep: string
  endereco: string
  numero: number
  bairro: string
  cidade: string
  estado: string
  telefone: string
  celular: string
}

async function upsertClient(params: ClientData) {
  const cpf = formatCpf(params.cpf)
  const email = params.email

  // Verificar se já existe no Supabase (via email) para reaproveitar supabaseId
  const existingClient = await prisma.client.findUnique({ where: { cpf } })

  let supabaseId: string

  if (!existingClient?.supabaseId) {
    const { data: authData, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'cliente' },
      user_metadata: { nome: params.nome },
    })

    if (error) {
      if (error.message?.includes('already been registered')) {
        const { data: listData } = await supabase.auth.admin.listUsers()
        const users = (listData as any)?.users ?? []
        const found = users.find((u: any) => u.email === email)
        if (!found) { console.error(`  [erro] Supabase (${email}): ${error.message}`); return }
        supabaseId = found.id
      } else {
        console.error(`  [erro] Supabase createUser (${email}): ${error.message}`); return
      }
    } else {
      supabaseId = authData.user.id
    }
  } else {
    supabaseId = existingClient.supabaseId
  }

  const clientData = {
    nome: params.nome,
    cpf,
    rg: params.rg,
    dataNascimento: parseDate(params.dataNasc),
    identidadeGenero: params.genero,
    email,
    cep: params.cep,
    endereco: `${params.endereco}, ${params.numero}`,
    bairro: params.bairro,
    cidade: params.cidade,
    estado: params.estado,
    telefone: formatPhone(params.telefone),
    whatsapp: formatPhone(params.celular),
    supabaseId,
    portalAtivo: true,
    portalAtivadoEm: existingClient?.portalAtivadoEm ?? new Date(),
    active: true,
  }

  const client = await prisma.client.upsert({
    where: { cpf },
    create: clientData,
    update: clientData,
  })

  await supabase.auth.admin.updateUserById(supabaseId, {
    app_metadata: { role: 'cliente', clientId: client.id, tipo: 'cliente' },
  })

  console.log(`  [ok] cliente "${params.nome}" upsert — id ${client.id}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== SIAFI Seed — Operadores ===')
  await createOperator({ nome: 'João de Deus',  username: 'adm',        email: 'adm@siafi.lidera.srv.br',        role: 'admin' })
  await createOperator({ nome: 'Ana Maria',      username: 'financeiro', email: 'financeiro@siafi.lidera.srv.br', role: 'financeiro' })
  await createOperator({ nome: 'Maria Clara',    username: 'caixa',      email: 'caixa@siafi.lidera.srv.br',      role: 'caixa' })
  await createOperator({ nome: 'José Santanna',  username: 'consultor',  email: 'consultor@siafi.lidera.srv.br',  role: 'consultor' })

  console.log('\n=== SIAFI Seed — Clientes ===')
  await upsertClient({
    nome: 'Eloá Clara Analu Nascimento',
    cpf: '90150459173', rg: '207958312', dataNasc: '05/05/1987',
    genero: 'feminino',
    email: 'cliente1@siafi.lidera.srv.br',
    cep: '78780970', endereco: 'Avenida Carlos Hugney 260', numero: 923,
    bairro: 'Centro', cidade: 'Alto Araguaia', estado: 'MT',
    telefone: '6628852692', celular: '66987868475',
  })
  await upsertClient({
    nome: 'Juan Ian Barros',
    cpf: '38979033184', rg: '454429939', dataNasc: '19/05/1987',
    genero: 'masculino',
    email: 'cliente2@siafi.lidera.srv.br',
    cep: '78780970', endereco: 'Avenida Carlos Hugney 260', numero: 245,
    bairro: 'Centro', cidade: 'Alto Araguaia', estado: 'MT',
    telefone: '6635574121', celular: '66992010928',
  })
  await upsertClient({
    nome: 'Fernanda Alícia Teixeira',
    cpf: '63231627176', rg: '236314993', dataNasc: '16/02/1987',
    genero: 'feminino',
    email: 'cliente3@siafi.lidera.srv.br',
    cep: '78780970', endereco: 'Avenida Carlos Hugney 260', numero: 904,
    bairro: 'Centro', cidade: 'Alto Araguaia', estado: 'MT',
    telefone: '6626587467', celular: '66999571196',
  })

  console.log('\nSeed concluído.\n')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
