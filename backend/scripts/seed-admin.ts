/**
 * Seed: cria o usuário administrador inicial no Supabase Auth + Prisma.
 * Executar: npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const ADMIN = {
  nome: 'Administrador',
  username: 'admin',
  password: 'Admin@2026',
  role: 'admin' as const,
};

async function main() {
  console.log('🌱 Criando usuário admin...');

  const email = `${ADMIN.username}@siafi.local`;

  // Remove se já existir no Supabase (idempotente)
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  if (found) {
    await supabase.auth.admin.deleteUser(found.id);
    console.log('  → Removido usuário Supabase anterior');
  }

  // Remove se já existir no Prisma
  await prisma.user.deleteMany({ where: { username: ADMIN.username } });

  // 1. Cria no Prisma primeiro para obter o id
  const hashedPw = await bcrypt.hash(ADMIN.password, 12);
  const prismaUser = await prisma.user.create({
    data: {
      nome: ADMIN.nome,
      username: ADMIN.username,
      password: hashedPw,
      role: ADMIN.role,
      active: true,
    },
  });

  // 2. Cria no Supabase Auth
  const { data: authData, error } = await supabase.auth.admin.createUser({
    email,
    password: ADMIN.password,
    email_confirm: true,
    app_metadata: { role: ADMIN.role, prismaId: prismaUser.id },
    user_metadata: { nome: ADMIN.nome, username: ADMIN.username },
  });

  if (error || !authData.user) {
    throw new Error(`Erro Supabase: ${error?.message}`);
  }

  // 3. Vincula supabaseId ao registro Prisma
  await prisma.user.update({
    where: { id: prismaUser.id },
    data: { supabaseId: authData.user.id },
  });

  console.log('✅ Usuário admin criado com sucesso!');
  console.log(`   Username : ${ADMIN.username}`);
  console.log(`   Senha    : ${ADMIN.password}`);
  console.log(`   Email    : ${email}`);
  console.log(`   Prisma ID: ${prismaUser.id}`);
  console.log(`   Supabase : ${authData.user.id}`);
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
