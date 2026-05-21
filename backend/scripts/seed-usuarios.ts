/**
 * Seed: cria usuários operadores e clientes padrão.
 * Idempotente — pode ser re-executado sem duplicar registros.
 *
 * Executar:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-usuarios.ts
 */
import 'dotenv/config';
import { PrismaClient, UserRole, GenderIdentity } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const SENHA = 'Siafi@1234';

// ─── Operadores ───────────────────────────────────────────────────────────────

const OPERADORES: Array<{
  nome: string;
  username: string;
  email: string;
  role: UserRole;
}> = [
  { nome: 'Administrador',  username: 'adm',        email: 'adm@siafi.lidera.srv.br',        role: 'admin'      },
  { nome: 'Financeiro',     username: 'financeiro',  email: 'financeiro@siafi.lidera.srv.br', role: 'financeiro' },
  { nome: 'Caixa',          username: 'caixa',       email: 'caixa@siafi.lidera.srv.br',      role: 'caixa'      },
  { nome: 'Consultor',      username: 'consultor',   email: 'consultor@siafi.lidera.srv.br',  role: 'consultor'  },
];

// ─── Clientes ─────────────────────────────────────────────────────────────────

interface ClienteSeed {
  nome: string;
  cpf: string;
  rg: string;
  dataNasc: string;       // DD/MM/YYYY
  genero: GenderIdentity;
  email: string;          // também será username
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  whatsapp: string;
  telefone: string;
}

const CLIENTES: ClienteSeed[] = [
  {
    nome:     'Eloá Clara Analu Nascimento',
    cpf:      '90150459173',
    rg:       '207958312',
    dataNasc: '05/05/1987',
    genero:   'feminino',
    email:    'cliente1@siafi.lidera.srv.br',
    cep:      '78780970',
    endereco: 'Avenida Carlos Hugney, 923',
    bairro:   'Centro',
    cidade:   'Alto Araguaia',
    estado:   'MT',
    whatsapp: '66987868475',
    telefone: '6628852692',
  },
  {
    nome:     'Juan Ian Barros',
    cpf:      '38979033184',
    rg:       '454429939',
    dataNasc: '19/05/1987',
    genero:   'masculino',
    email:    'cliente2@siafi.lidera.srv.br',
    cep:      '78780970',
    endereco: 'Avenida Carlos Hugney, 245',
    bairro:   'Centro',
    cidade:   'Alto Araguaia',
    estado:   'MT',
    whatsapp: '66992010928',
    telefone: '6635574121',
  },
  {
    nome:     'Fernanda Alícia Teixeira',
    cpf:      '63231627176',
    rg:       '236314993',
    dataNasc: '16/02/1987',
    genero:   'feminino',
    email:    'cliente3@siafi.lidera.srv.br',   // corrigido: era "@@"
    cep:      '78780970',
    endereco: 'Avenida Carlos Hugney, 904',
    bairro:   'Centro',
    cidade:   'Alto Araguaia',
    estado:   'MT',
    whatsapp: '66999571196',
    telefone: '6626587467',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseBR(date: string): Date {
  const [d, m, y] = date.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function supabaseEmail(username: string): string {
  return `${username}@siafi.local`;
}

async function criarOuAtualizarSupabase(
  email: string,
  password: string,
  appMeta: Record<string, unknown>,
): Promise<string> {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const found = list?.users?.find((u) => u.email === email);

  if (found) {
    await supabase.auth.admin.updateUserById(found.id, {
      password,
      app_metadata: appMeta,
    });
    console.log(`    Supabase atualizado: ${email}`);
    return found.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: appMeta,
  });
  if (error || !data.user) throw new Error(`Supabase createUser falhou: ${error?.message}`);
  console.log(`    Supabase criado: ${email}`);
  return data.user.id;
}

// ─── Seed Operadores ──────────────────────────────────────────────────────────

async function seedOperadores() {
  console.log('\n▸ Operadores');
  const hashedPw = await bcrypt.hash(SENHA, 12);

  for (const op of OPERADORES) {
    const sbEmail = supabaseEmail(op.username);

    // Upsert Prisma
    let dbUser = await prisma.user.findFirst({
      where: { OR: [{ username: op.username }, { email: op.email }] },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          nome:     op.nome,
          username: op.username,
          email:    op.email,
          password: hashedPw,
          role:     op.role,
          active:   true,
        },
      });
      console.log(`  ✓ Criado: ${op.username} (${op.role})`);
    } else {
      await prisma.user.update({
        where: { id: dbUser.id },
        data:  { email: op.email, role: op.role, active: true },
      });
      console.log(`  ~ Atualizado: ${op.username} (${op.role})`);
    }

    // Supabase Auth
    const supabaseId = await criarOuAtualizarSupabase(sbEmail, SENHA, {
      role:     op.role,
      prismaId: dbUser.id,
      tipo:     'operador',
    });

    if (dbUser.supabaseId !== supabaseId) {
      await prisma.user.update({ where: { id: dbUser.id }, data: { supabaseId } });
    }
  }
}

// ─── Seed Clientes ────────────────────────────────────────────────────────────

async function seedClientes() {
  console.log('\n▸ Clientes');
  const hashedPw = await bcrypt.hash(SENHA, 12);

  for (const cl of CLIENTES) {
    const username = cl.email.split('@')[0];
    const sbEmail  = supabaseEmail(username);

    // 1. User record
    let dbUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: cl.email }] },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          nome:     cl.nome,
          username,
          email:    cl.email,
          password: hashedPw,
          role:     'cliente',
          active:   true,
        },
      });
      console.log(`  ✓ User criado: ${username}`);
    } else {
      await prisma.user.update({
        where: { id: dbUser.id },
        data:  { email: cl.email, role: 'cliente', active: true },
      });
      console.log(`  ~ User atualizado: ${username}`);
    }

    // 2. Client record
    let dbClient = await prisma.client.findFirst({
      where: { OR: [{ cpf: cl.cpf }, { email: cl.email }] },
    });

    if (!dbClient) {
      dbClient = await prisma.client.create({
        data: {
          nome:            cl.nome,
          cpf:             cl.cpf,
          rg:              cl.rg,
          dataNascimento:  parseBR(cl.dataNasc),
          identidadeGenero: cl.genero,
          email:           cl.email,
          whatsapp:        cl.whatsapp,
          telefone:        cl.telefone,
          endereco:        cl.endereco,
          bairro:          cl.bairro,
          cidade:          cl.cidade,
          estado:          cl.estado,
          cep:             cl.cep,
          userId:          dbUser.id,
          active:          true,
          portalAtivo:     true,
          portalAtivadoEm: new Date(),
        },
      });
      console.log(`  ✓ Client criado: ${cl.nome}`);
    } else {
      await prisma.client.update({
        where: { id: dbClient.id },
        data:  { userId: dbUser.id, portalAtivo: true, active: true },
      });
      console.log(`  ~ Client atualizado: ${cl.nome}`);
    }

    // 3. Supabase Auth
    const supabaseId = await criarOuAtualizarSupabase(sbEmail, SENHA, {
      role:     'cliente',
      prismaId: dbUser.id,
      clientId: dbClient.id,
      tipo:     'cliente',
    });

    const updates: Record<string, unknown> = {};
    if (dbUser.supabaseId !== supabaseId)   updates['supabaseId'] = supabaseId;
    if (Object.keys(updates).length)
      await prisma.user.update({ where: { id: dbUser.id }, data: updates });

    if (!dbClient.supabaseId) {
      await prisma.client.update({
        where: { id: dbClient.id },
        data:  { supabaseId },
      });
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seed de usuários padrão — SIAFI\n');
  console.log(`   Senha padrão: ${SENHA}`);

  await seedOperadores();
  await seedClientes();

  console.log('\n✅ Seed concluído!\n');
  console.log('Usuários criados:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Email                              Role         Senha');
  console.log('─────────────────────────────────────────────────────────────');
  [...OPERADORES, ...CLIENTES.map(c => ({ email: c.email, role: 'cliente', nome: c.nome }))].forEach((u) => {
    console.log(`${u.email.padEnd(35)} ${(u.role as string).padEnd(12)} ${SENHA}`);
  });
  console.log('─────────────────────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
