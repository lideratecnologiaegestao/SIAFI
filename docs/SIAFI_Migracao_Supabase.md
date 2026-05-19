# SIAFI 2.0 — Plano de Migração para Supabase
**Lidera Tecnologia e Gestão Ltda.**
Versão do Plano: 1.0 · Maio 2026

---

## Visão Geral da Migração

| O que muda | De | Para |
|---|---|---|
| Banco de Dados | MySQL/MariaDB (local) | PostgreSQL (Supabase Cloud) |
| Autenticação | JWT manual + bcrypt | Supabase Auth (GoTrue) |
| Login Social | ❌ | OAuth Google |
| MFA | ❌ | Google Authenticator (TOTP) |
| Armazenamento de Arquivos | Disco local (Windows Server) | Supabase Storage |
| Dashboard em Tempo Real | ❌ (polling) | Supabase Realtime |
| ORM | Prisma (mysql) | Prisma (postgresql) |

---

## Etapas da Migração

### Etapa 1 — Preparação do Ambiente Supabase
1. Criar projeto no [supabase.com](https://supabase.com)
2. Copiar a **Connection String** (modo `Transaction Pooler` para NestJS)
3. Anotar a **Project URL** e **anon key** (para o frontend)
4. Anotar a **service_role key** (para o backend — nunca expor no frontend)
5. Configurar `.env` do backend e frontend com as novas variáveis

### Etapa 2 — Migração do Schema (Prisma)
1. Alterar `datasource db { provider = "postgresql" }` no `schema.prisma`
2. Ajustar tipos incompatíveis (MySQL → PostgreSQL):
   - `@db.VarChar(N)` → manter ou remover (PostgreSQL é mais flexível)
   - `@db.Text` → manter
   - `@db.Char(2)` → manter
   - `@db.Decimal(10,2)` → manter
3. Rodar `npx prisma migrate dev --name init_postgres`
4. Verificar se todas as tabelas foram criadas no Supabase

### Etapa 3 — Substituição do Auth Module (NestJS)
1. Remover dependências: `@nestjs/jwt`, `passport-jwt`, `bcrypt`
2. Instalar: `@supabase/supabase-js`
3. Criar `SupabaseAuthGuard` que valida o JWT do Supabase via `supabase.auth.getUser(token)`
4. Manter o enum `UserRole` no Prisma — sincronizar com `user_metadata` do Supabase Auth
5. Adaptar o `AuthService` para criar/verificar usuários via Supabase Admin SDK
6. Remover tabela `refresh_tokens` (gerenciada pelo Supabase)

### Etapa 4 — OAuth Google
1. Criar projeto no [Google Cloud Console](https://console.cloud.google.com)
2. Criar credenciais OAuth 2.0:
   - Authorized redirect URI: `https://<projeto>.supabase.co/auth/v1/callback`
3. Adicionar `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no painel Supabase → Authentication → Providers → Google
4. No frontend Next.js:
   ```ts
   supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://financeiro.lidera.app.br/auth/callback' } })
   ```
5. Criar rota `/auth/callback/page.tsx` no Next.js para capturar a sessão

### Etapa 5 — MFA com Google Authenticator (TOTP)
1. Ativar MFA no painel Supabase → Authentication → MFA
2. Obrigar MFA para roles `admin` e `financeiro` via middleware no NestJS
3. No frontend, implementar tela de setup do TOTP (QR Code gerado pelo Supabase)
4. Implementar tela de challenge (input do código de 6 dígitos)

### Etapa 6 — Supabase Storage (Documentos)
1. Criar 3 buckets no Supabase Storage:
   - `clientes-fotos` (público)
   - `clientes-documentos` (privado — apenas autenticado)
   - `contratos-pdf` (privado)
2. Configurar políticas RLS nos buckets
3. Refatorar `ClientsService` no NestJS: upload via Supabase Admin SDK
4. Atualizar campos no Prisma: `fotoPath`, `rgPath`, `comprovantePath` passam a armazenar a URL pública/assinada do Storage

### Etapa 7 — Supabase Realtime (Dashboard ao Vivo)
1. Ativar Replication nas tabelas: `installments`, `payments`, `transactions`
2. No frontend, criar hook `useRealtimeDashboard()` com `supabase.channel()`
3. Atualizar cards do Dashboard sem polling — eventos `INSERT`/`UPDATE` em tempo real

### Etapa 8 — Row Level Security (RLS)
1. Ativar RLS nas tabelas sensíveis via Supabase Dashboard
2. Criar políticas para a role `CLIENTE`:
   - `loans`: `client_id = auth.uid()` (via metadado)
   - `installments`: via JOIN com loans do cliente
3. Backend (NestJS) continua sendo a camada principal — RLS é a segunda barreira

---

## Variáveis de Ambiente Necessárias

### Backend (`backend/.env`)
```env
# Banco de Dados (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

# Supabase
SUPABASE_URL="https://[ref].supabase.co"
SUPABASE_SERVICE_ROLE_KEY="eyJ..."  # Nunca expor no frontend

# App
NODE_ENV=production
JWT_SECRET=sua_chave_secreta_longa
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL="https://[ref].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
NEXT_PUBLIC_API_URL="https://financeiro.lidera.app.br/api"
```

### Prisma (`schema.prisma` — atualizado)
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")  // Necessário com pgBouncer
}
```

---

## Checklist de Validação Pós-Migração

- [ ] Todas as tabelas criadas no Supabase (verificar no Table Editor)
- [ ] Login com usuário/senha funcionando via Supabase Auth
- [ ] Login com Google OAuth redirecionando corretamente
- [ ] MFA setup e challenge funcionando para Admin/Financeiro
- [ ] Upload de foto de cliente salvando no Storage
- [ ] URL do documento salva no banco (Prisma)
- [ ] Dashboard atualizando em tempo real ao registrar pagamento
- [ ] RolesGuard retornando 403 para acessos não autorizados
- [ ] Webhook do Mercado Pago processando e dando baixa normalmente
- [ ] Cron Jobs (markOverdue, lembretes) executando nos horários corretos

---

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Tipos de dado incompatíveis Prisma MySQL→PG | Rodar `prisma migrate dev` em ambiente de teste antes de produção |
| Usuários existentes sem Supabase Auth UID | Script de sync: criar usuário no Supabase e vincular UUID ao registro do Prisma |
| Upload de arquivos grandes travando | Usar upload direto do frontend para o Supabase Storage (bypassa o NestJS) |
| Latência do Supabase (São Paulo) | Supabase tem região `sa-east-1` — usar essa na criação do projeto |

---

## Prompt Completo para o Claude Executar a Migração

Copie e cole o bloco abaixo em uma nova conversa com o Claude, **junto com os arquivos de documentação do projeto** (01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md):

---

```
Você é um Arquiteto de Soluções e Engenheiro de Software Sênior especializado em NestJS, Next.js e Supabase. Analise toda a documentação do projeto SIAFI 2.0 anexada (Arquitetura, Backend, Frontend e Database) e execute a migração completa descrita abaixo.

## Contexto do Projeto
- Sistema financeiro de factoring/empréstimos (Lidera Tecnologia)
- Stack atual: NestJS 10 + Next.js 16 + Prisma + MySQL/MariaDB
- Stack destino: mesma base, mas substituindo MySQL por PostgreSQL via Supabase
- Dados: apenas dados de teste — migração sem restrições de backup
- Infraestrutura: Windows Server + Nginx + PM2

## O que deve ser feito (nesta ordem):

### 1. PRISMA — Migração MySQL → PostgreSQL
- Refatore o `schema.prisma` alterando `provider = "postgresql"`
- Adicione o campo `directUrl` no datasource (obrigatório com pgBouncer do Supabase)
- Ajuste os tipos incompatíveis conforme necessário
- Mantenha TODOS os models atuais: User, Client, Loan, Installment, Payment, Transaction, PixPayment, MpPayment, Renegociacao, Notification, AuditLog, SiteSetting, SupportTicket
- REMOVA o model `RefreshToken` (será gerenciado pelo Supabase Auth)
- Adicione os campos necessários para integração com Supabase Auth:
  - `supabaseId String? @unique @map("supabase_id")` no model User
- Mantenha o enum `UserRole` (admin, financeiro, caixa, usuario, cliente)
- Mostre o arquivo `schema.prisma` completo e atualizado

### 2. BACKEND — Substituição do Auth Module (NestJS)
- Instale `@supabase/supabase-js`
- Crie `src/modules/auth/supabase-auth.guard.ts`:
  - Valide o Bearer token usando `supabaseAdmin.auth.getUser(token)`
  - Extraia o `user_metadata.role` para popular o contexto de autorização
  - Retorne 401 se token inválido ou expirado
- Refatore `src/modules/auth/auth.service.ts`:
  - `login()`: autenticar via `supabase.auth.signInWithPassword()`
  - `createOperator()`: criar via `supabaseAdmin.auth.admin.createUser()` + salvar no Prisma com o `supabaseId`
  - `syncRole()`: após criar usuário, atualizar `user_metadata: { role: UserRole }` no Supabase
- Crie `src/modules/auth/mfa.service.ts`:
  - `setupMFA(userId)`: iniciar enrollment TOTP via Supabase
  - `verifyMFA(userId, code)`: verificar o desafio TOTP
  - Obrigue MFA para roles `admin` e `financeiro` no fluxo de login
- Adapte o `SupabaseAuthGuard` para funcionar nos controllers existentes como substituto direto do `JwtAuthGuard`
- Mantenha o `RolesGuard` e os decorators `@Roles()` e `@CurrentUser()` — apenas ajuste de onde extraem os dados (agora vêm do Supabase JWT)
- Crie o arquivo `.env.example` do backend com todas as variáveis documentadas

### 3. BACKEND — Supabase Storage (Documentos de Clientes)
- Substitua o multer local pelo Supabase Storage no `ClientsService`
- Crie `src/modules/storage/storage.service.ts` com métodos:
  - `uploadFile(bucket, path, file, mimeType)`: upload via Supabase Admin SDK
  - `getSignedUrl(bucket, path, expiresIn)`: URL assinada para documentos privados
  - `deleteFile(bucket, path)`: exclusão ao deletar cliente
- Buckets a criar: `clientes-fotos` (público), `clientes-documentos` (privado), `contratos-pdf` (privado)
- Atualize o `ClientsController` para usar o `StorageService` em vez de `multer`
- Os campos `fotoPath`, `rgPath`, `comprovantePath` passam a armazenar a URL do Supabase Storage

### 4. FRONTEND — Supabase Auth Client (Next.js)
- Instale `@supabase/ssr` e `@supabase/supabase-js`
- Crie `src/lib/supabase/client.ts` (client-side) e `src/lib/supabase/server.ts` (server-side com cookies)
- Crie `src/lib/supabase/middleware.ts` para refresh automático de sessão no Next.js Middleware
- Refatore `src/contexts/auth.context.tsx`:
  - Use `supabase.auth.getSession()` para obter a sessão atual
  - Use `supabase.auth.onAuthStateChange()` para reatividade
  - Mantenha a interface do contexto idêntica (`user`, `login`, `logout`, `isLoading`) para não quebrar os componentes existentes
- Adapte `src/lib/api.ts`:
  - Remova a lógica manual de refresh token
  - Use o token da sessão Supabase no header `Authorization: Bearer`

### 5. FRONTEND — Login com Google OAuth
- Atualize `src/app/(auth)/login/page.tsx`:
  - Adicione botão "Entrar com Google" com ícone oficial
  - Chame `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: process.env.NEXT_PUBLIC_URL + '/auth/callback' } })`
- Crie `src/app/auth/callback/route.ts` (Route Handler):
  - Capture o `code` da query string
  - Execute `supabase.auth.exchangeCodeForSession(code)`
  - Redirecione para `/dashboard`
- Mantenha o fluxo de login com usuário/senha funcionando simultaneamente

### 6. FRONTEND — MFA Setup e Challenge
- Crie `src/app/(auth)/mfa-setup/page.tsx`:
  - Exiba o QR Code gerado pelo Supabase para o Google Authenticator
  - Campo para o usuário confirmar o código de 6 dígitos antes de ativar
- Crie `src/app/(auth)/mfa-challenge/page.tsx`:
  - Tela pós-login para usuários com MFA ativo
  - Input do código TOTP de 6 dígitos
  - Botão "Verificar" que chama `supabase.auth.mfa.verify()`
- Redirecione automaticamente para `/mfa-challenge` se a sessão retornar `assurance_level: 'aal1'` e o usuário for `admin` ou `financeiro`

### 7. FRONTEND — Realtime Dashboard
- Crie `src/hooks/useRealtimeDashboard.ts`:
  - Subscribe ao canal `payments` para evento `INSERT`
  - Subscribe ao canal `installments` para evento `UPDATE`
  - Ao receber evento, dispare `refetch()` das queries relevantes (React Query)
- Integre o hook na `src/app/(dashboard)/dashboard/page.tsx`
- Adicione um indicador visual sutil (ponto verde pulsante) quando o Realtime estiver conectado

### 8. ARQUIVOS DE CONFIGURAÇÃO
- Gere o `backend/.env.example` completo e documentado
- Gere o `frontend/.env.local.example` completo e documentado
- Gere o `backend/prisma/schema.prisma` final e completo

## Regras de Qualidade Obrigatórias
- Use SEMPRE `$transaction` do Prisma em operações multi-tabela
- NUNCA exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Todos os endpoints continuam protegidos pelo `SupabaseAuthGuard` + `RolesGuard`
- Mantenha o `AuditInterceptor` funcionando com o novo sistema de auth
- O `@CurrentUser()` decorator deve continuar funcionando nos controllers
- Use TypeScript strict — sem `any` desnecessário
- Siga os padrões Clean Architecture e SOLID já estabelecidos no projeto

## Entregue nesta ordem:
1. `schema.prisma` completo e atualizado
2. Módulo Auth refatorado (guard, service, mfa.service)
3. Storage service
4. Arquivos frontend (supabase client, auth context, login page, callback, mfa pages)
5. Hook de Realtime
6. Arquivos .env.example de ambos os projetos
7. Checklist de validação pós-implementação

Comece pelo item 1 (schema.prisma).
```

---

## Dicas de Execução

**Peça um item por vez.** O Claude produz código muito mais preciso quando você diz "agora implemente o item 2" em vez de tudo de uma vez.

**Após cada entrega, valide:**
```powershell
# Backend — verificar se compila
cd D:\LIDERA\SIAFI\backend
npm run build

# Verificar se Prisma reconhece o novo schema
npx prisma validate
npx prisma migrate dev --name migra_postgres
```

**Ordem de testes recomendada:**
1. Banco conectando → `npx prisma studio`
2. Login funcionando → testar POST /api/auth/login
3. Google OAuth → testar no navegador
4. MFA → testar com conta admin
5. Upload de foto → testar cadastro de cliente
6. Realtime → abrir dashboard e registrar pagamento em outra aba

---

*Plano elaborado com base na documentação SIAFI 2.0 · Maio 2026*
