/**
 * Migration script: sistema_financeiro (PHP legacy) → siafi_v2 (SIAFI 2.0)
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/migrate-legacy.ts
 *
 * Safe to run multiple times (idempotent via upsert/skip-existing).
 * Run with the backend stopped to avoid Prisma connection conflicts.
 *
 * Usuários migrados recebem senha temporária: Mudar@2026
 * (deve ser alterada no primeiro acesso)
 */

import * as dotenv from 'dotenv'
dotenv.config()

import * as mysql from 'mysql2/promise'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()

const supabaseAdmin: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// Legacy DB connection (sistema_financeiro)
const LEGACY_DB = {
  host: '127.0.0.1',
  port: 3306,
  user: 'db_financ3ir0',
  password: 'IUHIdjjhyhmshhtgjskhgs34567',
  database: 'sistema_financeiro',
  dateStrings: true,
}

// Senha temporária para todos os usuários migrados
const TEMP_PASSWORD = 'Mudar@2026'

type Row = Record<string, unknown>

function toDate(val: unknown): Date | null {
  if (!val) return null
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d
}

function toDecimal(val: unknown): number {
  return val != null ? Number(val) : 0
}

function trimStr(val: unknown): string | null {
  if (val == null) return null
  const s = String(val).trim()
  return s === '' ? null : s
}

async function migrateUsers(conn: mysql.Connection): Promise<Map<number, number>> {
  console.log('\n→ Migrando usuários...')
  const idMap = new Map<number, number>()

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM users')

  for (const row of rows as Row[]) {
    const legacyId = Number(row['id'])
    const username = String(row['username'])

    const roleMap: Record<string, string> = {
      admin: 'admin',
      financeiro: 'financeiro',
      caixa: 'caixa',
      usuario: 'usuario',
      cliente: 'cliente',
    }
    const role = roleMap[String(row['role'] ?? 'usuario')] ?? 'usuario'

    let password = String(row['password'] ?? '')
    if (!password.startsWith('$2')) {
      password = await bcrypt.hash(password || 'mudar123', 10)
    }

    // Email: usa o do legado ou gera um fictício baseado no username
    const email = trimStr(row['email']) ?? `${username}@siafi.local`
    const nome = String(row['nome'] ?? row['name'] ?? 'Usuário')
    const active = Boolean(row['active'] ?? row['ativo'] ?? true)

    try {
      // ── 1. Verifica se já existe no Prisma ────────────────────────────
      const existing = await prisma.user.findUnique({ where: { username } })

      let prismaUserId: number
      let supabaseId: string | null = existing?.supabaseId ?? null

      if (existing) {
        prismaUserId = existing.id
        idMap.set(legacyId, prismaUserId)
        console.log(`  skip prisma user ${username} (id=${prismaUserId})`)
      } else {
        const user = await prisma.user.create({
          data: {
            nome,
            username,
            password,
            role: role as 'admin' | 'financeiro' | 'caixa' | 'usuario' | 'cliente',
            active,
            createdAt: toDate(row['created_at']) ?? new Date(),
            updatedAt: new Date(),
          },
        })
        prismaUserId = user.id
        idMap.set(legacyId, prismaUserId)
        console.log(`  ✓ prisma user ${username} (${legacyId} → ${prismaUserId})`)
      }

      // ── 2. Cria no Supabase Auth (se ainda não tem supabaseId) ────────
      if (!supabaseId) {
        // Tenta criar — se o email já existe no Auth, busca pelo email
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: TEMP_PASSWORD,
          email_confirm: true,
          app_metadata: { role },
          user_metadata: { username, nome, role },
        })

        if (createErr) {
          if (createErr.message.includes('already been registered') || createErr.message.includes('already exists')) {
            // Busca o usuário existente por email
            const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
            const found = list?.users?.find((u) => u.email === email)
            if (found) {
              supabaseId = found.id
              console.log(`    ↳ supabase auth: email ${email} já existe, supabaseId=${supabaseId}`)
            } else {
              console.warn(`    ↳ supabase auth: erro ao criar ${email}: ${createErr.message}`)
            }
          } else {
            console.warn(`    ↳ supabase auth erro ${email}: ${createErr.message}`)
          }
        } else {
          supabaseId = created.user.id
          console.log(`    ↳ supabase auth criado ${email} → supabaseId=${supabaseId}`)
        }

        // ── 3. Salva supabaseId no Prisma ─────────────────────────────
        if (supabaseId) {
          await prisma.user.update({
            where: { id: prismaUserId },
            data: { supabaseId },
          })
        }
      } else {
        console.log(`    ↳ supabase auth: já vinculado supabaseId=${supabaseId}`)
      }
    } catch (err) {
      console.error(`  ✗ user ${username}:`, (err as Error).message)
    }
  }

  return idMap
}

async function migrateClients(conn: mysql.Connection): Promise<Map<number, number>> {
  console.log('\n→ Migrando clientes...')
  const idMap = new Map<number, number>()

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM clients')

  for (const row of rows as Row[]) {
    const legacyId = Number(row['id'])

    try {
      const cpf = trimStr(row['cpf'])
      const existing = cpf
        ? await prisma.client.findUnique({ where: { cpf } })
        : null

      if (existing) {
        idMap.set(legacyId, existing.id)
        console.log(`  skip client ${row['nome']} cpf=${cpf} (id=${existing.id})`)
        continue
      }

      const client = await prisma.client.create({
        data: {
          nome: String(row['nome']),
          cpf,
          rg: trimStr(row['rg']),
          dataNascimento: toDate(row['data_nascimento']),
          email: trimStr(row['email']),
          whatsapp: trimStr(row['whatsapp']),
          telefone: trimStr(row['telefone']),
          endereco: trimStr(row['endereco']),
          bairro: trimStr(row['bairro']),
          cidade: trimStr(row['cidade']),
          estado: trimStr(row['estado']),
          cep: trimStr(row['cep']),
          // Caminhos locais migrados; arquivos físicos não são copiados automaticamente
          fotoPath: trimStr(row['foto_path']),
          rgPath: trimStr(row['rg_path']),
          comprovantePath: trimStr(row['comprovante_path']),
          active: Boolean(row['active'] ?? 1),
          notificacoesEmail: Boolean(row['notificacoes_email'] ?? 1),
          observacoes: trimStr(row['observacoes']),
          createdAt: toDate(row['created_at']) ?? new Date(),
          updatedAt: new Date(),
        },
      })

      idMap.set(legacyId, client.id)
      console.log(`  ✓ client ${client.nome} (${legacyId} → ${client.id})`)
    } catch (err) {
      console.error(`  ✗ client ${row['nome']}:`, (err as Error).message)
    }
  }

  return idMap
}

async function migrateLoans(
  conn: mysql.Connection,
  clientIdMap: Map<number, number>,
): Promise<Map<number, number>> {
  console.log('\n→ Migrando empréstimos...')
  const idMap = new Map<number, number>()

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM loans')

  const statusMap: Record<string, string> = {
    ativo: 'ativo',
    quitado: 'quitado',
    cancelado: 'cancelado',
    inadimplente: 'inadimplente',
    active: 'ativo',
    paid: 'quitado',
    cancelled: 'cancelado',
  }

  for (const row of rows as Row[]) {
    const legacyId = Number(row['id'])
    const newClientId = clientIdMap.get(Number(row['client_id']))

    if (!newClientId) {
      console.warn(`  skip loan ${legacyId}: client_id ${row['client_id']} não mapeado`)
      continue
    }

    try {
      const loan = await prisma.loan.create({
        data: {
          clientId: newClientId,
          valor: toDecimal(row['valor']),
          valorInvestido: row['valor_investido'] != null ? toDecimal(row['valor_investido']) : null,
          taxaJuros: toDecimal(row['taxa_juros']),
          modoTaxa: String(row['modo_taxa'] ?? 'mensal'),
          numeroParcelas: Number(row['numero_parcelas'] ?? 1),
          dataInicio: toDate(row['data_inicio']) ?? new Date(),
          status: (statusMap[String(row['status'] ?? 'ativo')] ?? 'ativo') as 'ativo' | 'quitado' | 'cancelado' | 'inadimplente',
          observacoes: trimStr(row['observacoes']),
          createdAt: toDate(row['created_at']) ?? new Date(),
          updatedAt: new Date(),
        },
      })

      idMap.set(legacyId, loan.id)
      console.log(`  ✓ loan ${legacyId} → ${loan.id}`)
    } catch (err) {
      console.error(`  ✗ loan ${legacyId}:`, (err as Error).message)
    }
  }

  return idMap
}

async function migrateInstallments(
  conn: mysql.Connection,
  loanIdMap: Map<number, number>,
): Promise<Map<number, number>> {
  console.log('\n→ Migrando parcelas...')
  const idMap = new Map<number, number>()

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM installments')

  const statusMap: Record<string, string> = {
    pendente: 'pendente',
    pago: 'pago',
    atrasado: 'atrasado',
    cancelado: 'cancelado',
    paid: 'pago',
    pending: 'pendente',
    overdue: 'atrasado',
  }

  for (const row of rows as Row[]) {
    const legacyId = Number(row['id'])
    const newLoanId = loanIdMap.get(Number(row['loan_id']))

    if (!newLoanId) {
      console.warn(`  skip installment ${legacyId}: loan_id ${row['loan_id']} não mapeado`)
      continue
    }

    try {
      const inst = await prisma.installment.create({
        data: {
          loanId: newLoanId,
          numero: Number(row['numero'] ?? row['number'] ?? 1),
          valor: toDecimal(row['valor']),
          dataVencimento: toDate(row['data_vencimento']) ?? new Date(),
          status: (statusMap[String(row['status'] ?? 'pendente')] ?? 'pendente') as 'pendente' | 'pago' | 'atrasado' | 'cancelado',
          totalPago: toDecimal(row['total_pago']),
          createdAt: toDate(row['created_at']) ?? new Date(),
          updatedAt: new Date(),
        },
      })

      idMap.set(legacyId, inst.id)
    } catch (err) {
      console.error(`  ✗ installment ${legacyId}:`, (err as Error).message)
    }
  }

  console.log(`  ✓ ${idMap.size} parcelas migradas`)
  return idMap
}

async function migratePayments(
  conn: mysql.Connection,
  installmentIdMap: Map<number, number>,
): Promise<void> {
  console.log('\n→ Migrando pagamentos...')

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM payments')

  const methodMap: Record<string, string> = {
    dinheiro: 'dinheiro',
    pix: 'pix',
    mercadopago: 'mercadopago',
    transferencia: 'transferencia',
    cheque: 'cheque',
    cartao: 'cartao',
    cash: 'dinheiro',
    card: 'cartao',
    transfer: 'transferencia',
  }

  let count = 0
  for (const row of rows as Row[]) {
    const legacyId = Number(row['id'])
    const newInstId = installmentIdMap.get(Number(row['installment_id']))

    if (!newInstId) {
      console.warn(`  skip payment ${legacyId}: installment_id não mapeado`)
      continue
    }

    try {
      await prisma.payment.create({
        data: {
          installmentId: newInstId,
          valorPago: toDecimal(row['valor_pago']),
          dataPagamento: toDate(row['data_pagamento']) ?? new Date(),
          metodoPagamento: (methodMap[String(row['metodo_pagamento'] ?? 'dinheiro')] ?? 'dinheiro') as 'dinheiro' | 'pix' | 'mercadopago' | 'transferencia' | 'cheque' | 'cartao',
          observacao: trimStr(row['observacao']),
          createdAt: toDate(row['created_at']) ?? new Date(),
        },
      })
      count++
    } catch (err) {
      console.error(`  ✗ payment ${legacyId}:`, (err as Error).message)
    }
  }

  console.log(`  ✓ ${count} pagamentos migrados`)
}

async function migrateTransactions(
  conn: mysql.Connection,
  userIdMap: Map<number, number>,
): Promise<void> {
  console.log('\n→ Migrando transações (caixa)...')

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM transactions')

  let count = 0
  for (const row of rows as Row[]) {
    try {
      const legacyUserId = row['user_id'] != null ? Number(row['user_id']) : null
      const newUserId = legacyUserId != null ? (userIdMap.get(legacyUserId) ?? null) : null

      await prisma.transaction.create({
        data: {
          tipo: String(row['tipo'] ?? 'entrada'),
          valor: toDecimal(row['valor']),
          descricao: trimStr(row['descricao']),
          categoria: trimStr(row['categoria']),
          data: toDate(row['data']) ?? new Date(),
          userId: newUserId,
          createdAt: toDate(row['created_at']) ?? new Date(),
        },
      })
      count++
    } catch (err) {
      console.error(`  ✗ transaction:`, (err as Error).message)
    }
  }

  console.log(`  ✓ ${count} transações migradas`)
}

async function migrateRenegociacoes(
  conn: mysql.Connection,
  loanIdMap: Map<number, number>,
): Promise<void> {
  console.log('\n→ Migrando renegociações...')

  let hasTable = true
  try {
    await conn.query('SELECT 1 FROM renegociacoes LIMIT 1')
  } catch {
    console.log('  tabela renegociacoes não existe no legado, pulando')
    hasTable = false
  }

  if (!hasTable) return

  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT * FROM renegociacoes')

  let count = 0
  for (const row of rows as Row[]) {
    const newLoanId = loanIdMap.get(Number(row['loan_id']))
    if (!newLoanId) continue

    try {
      await prisma.renegociacao.create({
        data: {
          loanId: newLoanId,
          valorTotal: toDecimal(row['valor_total']),
          numeroParcelas: Number(row['numero_parcelas'] ?? 1),
          taxaJuros: toDecimal(row['taxa_juros']),
          dataInicio: toDate(row['data_inicio']) ?? new Date(),
          observacoes: trimStr(row['observacoes']),
          createdAt: toDate(row['created_at']) ?? new Date(),
        },
      })
      count++
    } catch (err) {
      console.error(`  ✗ renegociacao:`, (err as Error).message)
    }
  }

  console.log(`  ✓ ${count} renegociações migradas`)
}

async function main() {
  console.log('=== SIAFI Migration: sistema_financeiro → siafi_v2 ===')
  console.log(`Iniciado em: ${new Date().toISOString()}`)
  console.log(`Senha temporária dos usuários migrados: ${TEMP_PASSWORD}`)

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('✗ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env')
    process.exit(1)
  }

  let conn: mysql.Connection | null = null

  try {
    conn = await mysql.createConnection(LEGACY_DB)
    console.log('✓ Conectado ao banco legado (sistema_financeiro)')

    await prisma.$connect()
    console.log('✓ Conectado ao banco novo (siafi_v2 via Prisma)')

    // Ordem importa (foreign keys)
    const userIdMap = await migrateUsers(conn)
    const clientIdMap = await migrateClients(conn)
    const loanIdMap = await migrateLoans(conn, clientIdMap)
    const installmentIdMap = await migrateInstallments(conn, loanIdMap)
    await migratePayments(conn, installmentIdMap)
    await migrateTransactions(conn, userIdMap)
    await migrateRenegociacoes(conn, loanIdMap)

    console.log('\n=== Migração concluída com sucesso! ===')
    console.log(`Finalizado em: ${new Date().toISOString()}`)

    const [uCount, cCount, lCount, iCount, pCount, tCount] = await Promise.all([
      prisma.user.count(),
      prisma.client.count(),
      prisma.loan.count(),
      prisma.installment.count(),
      prisma.payment.count(),
      prisma.transaction.count(),
    ])

    console.log('\nResumo do banco siafi_v2:')
    console.log(`  Usuários:     ${uCount}`)
    console.log(`  Clientes:     ${cCount}`)
    console.log(`  Empréstimos:  ${lCount}`)
    console.log(`  Parcelas:     ${iCount}`)
    console.log(`  Pagamentos:   ${pCount}`)
    console.log(`  Transações:   ${tCount}`)

    console.log(`\n⚠️  Lembrete: todos os usuários migrados têm senha temporária "${TEMP_PASSWORD}"`)
    console.log('   Peça para cada operador trocar a senha no primeiro acesso.')
  } catch (err) {
    console.error('\n✗ Erro fatal na migração:', err)
    process.exit(1)
  } finally {
    if (conn) await conn.end()
    await prisma.$disconnect()
  }
}

main()
