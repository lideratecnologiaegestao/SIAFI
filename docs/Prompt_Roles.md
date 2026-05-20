# Fase 1

Você é um Engenheiro de Software Sênior especializado em NestJS, Next.js e 
Supabase Auth. Preciso implementar um sistema de autenticação RESTRITIVO e 
SEGURO para o SIAFI — sistema financeiro de factoring e empréstimos.

## REGRA DE OURO
O sistema NUNCA permite que um desconhecido crie conta ou acesse o sistema.
Todo acesso depende de um cadastro prévio feito pelo administrador/financeiro.
O Supabase Auth é usado apenas como provedor de tokens — a fonte da verdade 
de quem pode acessar é SEMPRE o banco de dados do SIAFI (tabelas `users` e 
`clients`).

---

## 1. FLUXO DE AUTENTICAÇÃO POR ROLE

### Roles Operacionais (admin, financeiro, caixa, usuario)
- Cadastro feito EXCLUSIVAMENTE pelo Administrador no painel Users do SIAFI
- O admin informa: nome, username, email, role e senha inicial
- O sistema cria o usuário no Supabase Auth via Admin SDK 
  (`supabase.auth.admin.createUser`) e vincula o `supabase_id` no registro 
  da tabela `users` do Prisma
- Login permitido por: username+senha OU email+senha
- Login com Google: permitido SOMENTE se o email da conta Google for 
  IDÊNTICO ao email já cadastrado na tabela `users`. Se o email Google não 
  existir em `users`, retornar erro 403: "Acesso não autorizado. Conta não 
  cadastrada no sistema."
- NUNCA criar um novo registro em `users` automaticamente via OAuth

### Role CLIENTE
- Cadastro feito pelo operador (admin/financeiro) na tabela `clients`
- A conta de acesso ao Portal do Cliente é criada automaticamente quando o 
  operador marca "Habilitar acesso ao portal" no cadastro do cliente
- Vínculo obrigatório: o `supabase_id` do Auth deve ser salvo no campo 
  `supabase_id` da tabela `clients`
- Login permitido por:
  1. CPF + senha
  2. Email + senha  
  3. Google OAuth — SOMENTE se o email da conta Google for IDÊNTICO ao 
     campo `email` da tabela `clients`. Caso contrário: erro 403.
- NUNCA permitir que um cliente acesse dados de outro cliente

---

## 2. VALIDAÇÃO PRÉ-AUTENTICAÇÃO (hook no Supabase / guard no NestJS)

Implemente um `SupabaseAuthGuard` no NestJS que, após validar o JWT do 
Supabase, executa uma segunda verificação no banco:

```typescript
// Pseudocódigo da lógica obrigatória
async validateUser(supabaseId: string, email: string) {
  // Verifica se existe em `users` (roles operacionais)
  const operador = await prisma.user.findFirst({
    where: { supabaseId, active: true }
  });
  if (operador) return { ...operador, tipo: 'operador' };

  // Verifica se existe em `clients` (role cliente)
  const cliente = await prisma.client.findFirst({
    where: { supabaseId, active: true }
  });
  if (cliente) return { ...cliente, role: 'cliente', tipo: 'cliente' };

  // Não encontrou em nenhuma tabela — acesso negado
  throw new ForbiddenException(
    'Conta não autorizada. Acesso restrito a usuários cadastrados.'
  );
}
```

Para Google OAuth, adicionar verificação adicional ANTES de criar sessão:
```typescript
async validateGoogleOAuth(googleEmail: string) {
  const operador = await prisma.user.findFirst({
    where: { email: googleEmail, active: true }
  });
  const cliente = await prisma.client.findFirst({
    where: { email: googleEmail, active: true }
  });
  
  if (!operador && !cliente) {
    // Revogar sessão Supabase imediatamente
    await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
    throw new ForbiddenException('Email não cadastrado no sistema.');
  }
}
```

---

## 3. MULTI-FATOR (MFA) COM GOOGLE AUTHENTICATOR — LÓGICA DE PRAZO

Implemente a seguinte lógica de MFA com prazo de adesão:

### Campos necessários no schema Prisma
Adicione na tabela `users` E na tabela `clients`:
```prisma
mfaEnabled        Boolean   @default(false) @map("mfa_enabled")
mfaSecret         String?   @map("mfa_secret")
mfaLoginCount     Int       @default(0) @map("mfa_login_count")
mfaDecidedAt      DateTime? @map("mfa_decided_at")
mfaReminderShown  Int       @default(0) @map("mfa_reminder_shown")
```

### Fluxo do prazo de 5 logins
A cada login bem-sucedido sem MFA configurado:
1. Incrementar `mfaLoginCount` (+ 1)
2. Se `mfaLoginCount` <= 5 E `mfaEnabled = false`:
   - Retornar no payload do login: `{ mfaStatus: 'pendente', loginsRestantes: 5 - mfaLoginCount }`
   - Frontend exibe modal: "Você tem X login(s) restantes para configurar o 
     Google Authenticator. Configurar agora / Lembrar depois"
3. Se `mfaLoginCount` > 5 E `mfaEnabled = false`:
   - BLOQUEAR o login
   - Redirecionar OBRIGATORIAMENTE para a tela de setup do MFA
   - Retornar: `{ mfaStatus: 'obrigatorio' }`
   - O usuário SÓ consegue acessar o sistema após configurar o MFA
4. Se `mfaEnabled = true`:
   - Exigir o código TOTP de 6 dígitos a cada login (fluxo normal de 
     challenge/verify do Supabase)

### Exceção para roles
- MFA obrigatório imediato (sem prazo de 5 logins) para: `admin` e 
  `financeiro`
- Prazo de 5 logins para: `caixa`, `usuario` e `cliente`

---

## 4. LOGIN DO CLIENTE POR CPF

O Supabase Auth não suporta login por CPF nativamente. Implemente assim:

```typescript
// AuthService — login do cliente por CPF
async loginClienteByCpf(cpf: string, senha: string) {
  // 1. Buscar cliente pelo CPF no Prisma
  const cliente = await prisma.client.findFirst({
    where: { cpf: cpf.replace(/\D/g, ''), active: true }
  });
  if (!cliente) throw new UnauthorizedException('CPF não encontrado.');
  
  // 2. Usar o email vinculado para autenticar no Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cliente.email,
    password: senha,
  });
  if (error) throw new UnauthorizedException('CPF ou senha incorretos.');
  
  // 3. Retornar sessão + dados do cliente
  return { session: data.session, cliente };
}
```

---

## 5. SCHEMA PRISMA — ATUALIZAÇÕES NECESSÁRIAS

Atualize os models `User` e `Client` com os novos campos:

```prisma
model User {
  // ... campos existentes ...
  supabaseId        String?   @unique @map("supabase_id")
  email             String?   @unique
  mfaEnabled        Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount     Int       @default(0) @map("mfa_login_count")
  mfaDecidedAt      DateTime? @map("mfa_decided_at")
}

model Client {
  // ... campos existentes ...
  supabaseId        String?   @unique @map("supabase_id")
  portalAtivo       Boolean   @default(false) @map("portal_ativo")
  mfaEnabled        Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount     Int       @default(0) @map("mfa_login_count")
  mfaDecidedAt      DateTime? @map("mfa_decided_at")
}
```

---

## 6. FRONTEND — TELAS NECESSÁRIAS

### Tela de Login (página única para todos os tipos de usuário)
Implemente em `src/app/(auth)/login/page.tsx`:
- Campo: **CPF ou Email** (detectar automaticamente: se contiver apenas 
  números e traços = CPF, senão = email)
- Campo: **Senha**
- Botão: **Entrar com Google** (ícone oficial Google)
- Lógica: ao digitar CPF, mascarar automaticamente (000.000.000-00)
- Sem campo de "tipo de usuário" — o sistema identifica automaticamente 
  pela tabela onde encontrar o registro

### Tela de MFA Challenge (`/auth/mfa-challenge`)
- Input de 6 dígitos (estilo OTP — 6 caixas separadas)
- Botão verificar
- Link "Não consigo acessar meu autenticador" → abre ticket de suporte

### Tela de MFA Setup (`/auth/mfa-setup`)
- QR Code gerado pelo Supabase para escanear no Google Authenticator
- Campo para confirmar o código antes de ativar
- Para usuários no prazo: botão "Configurar depois" (decrementa 1 do prazo)
- Para usuários com prazo esgotado: SEM botão de pular — obrigatório 
  configurar

### Modal de Aviso MFA (componente reutilizável)
- Aparece após login bem-sucedido quando `mfaStatus === 'pendente'`
- Mensagem: "Proteja sua conta! Configure o Google Authenticator."
- Mostra contagem regressiva: "Você tem X acesso(s) antes de ser 
  obrigatório"
- Botões: "Configurar agora" / "Depois" (se ainda dentro do prazo)

---

## 7. ENTREGÁVEIS (nesta ordem)

1. Schema Prisma completo com os novos campos em `User` e `Client`
2. `AuthService` com todos os métodos:
   - `loginComEmailOuCpf(identificador, senha)`
   - `loginComGoogle(googleToken)` com validação restritiva
   - `verificarPrazoMfa(userId, role)`
   - `setupMfa(userId)` — gera QR Code
   - `confirmarMfa(userId, codigo)` — ativa o fator
   - `challengeMfa(userId, codigo)` — verifica no login
3. `SupabaseAuthGuard` com dupla verificação (JWT + banco)
4. Endpoint `POST /auth/habilitar-portal-cliente` para o admin ativar 
   acesso de um cliente ao portal
5. Tela de login unificada (Next.js) com detecção automática CPF/email
6. Telas de MFA setup e challenge
7. Modal de aviso de prazo MFA

## REGRAS TÉCNICAS OBRIGATÓRIAS
- Use `$transaction` do Prisma sempre que criar usuário no Supabase Auth 
  E no banco simultaneamente (garantir rollback se um falhar)
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no frontend
- Registrar TODA tentativa de acesso negado na tabela `audit_logs`
- Mensagens de erro genéricas para o usuário final (nunca revelar se o 
  email existe ou não — prevenir enumeração de usuários)
- Seguir padrões LGPD: CPF armazenado sem formatação (só números)

Por que esse prompt está correto para um sistema financeiro:
O ponto mais crítico — a validação dupla (JWT válido no Supabase + registro ativo no banco do SIAFI) — garante que mesmo que alguém consiga um token Supabase de alguma forma, sem estar na tabela users ou clients o acesso é negado imediatamente.
A lógica de prazo de 5 logins para MFA é inteligente: não bloqueia o usuário de imediato (evita abandono), mas cria urgência crescente e torna obrigatório após o prazo — padrão usado em sistemas bancários.


# Fase 2

Atue como Engenheiro de Software Sênior e Especialista em UX para sistemas 
financeiros. Preciso implementar a funcionalidade completa de "Ativação do 
Portal do Cliente" no SIAFI — sistema de factoring e empréstimos.

Esta funcionalidade permite que o Administrador ou Financeiro habilite o 
acesso de um cliente cadastrado na tabela `clients` ao Portal do Cliente, 
criando a conta dele no Supabase Auth de forma controlada e segura.

---

## 1. REGRAS DE NEGÓCIO

- Somente roles `admin` e `financeiro` podem ativar/desativar o portal
- O cliente precisa ter `email` cadastrado para ativar o portal
  (email é obrigatório para criar conta no Supabase Auth)
- Se o cliente não tiver email, exibir aviso e impedir a ativação
- Ao ativar: criar conta no Supabase Auth + vincular `supabase_id` 
  na tabela `clients` + setar `portalAtivo = true`
- Ao desativar: banir usuário no Supabase Auth 
  (`supabase.auth.admin.updateUser({ banned: true })`) + 
  setar `portalAtivo = false` — NÃO deletar a conta Supabase
- Reativar: remover ban + setar `portalAtivo = true`
- Toda ativação/desativação deve ser registrada no `AuditLog`
- O cliente recebe notificação (WhatsApp e/ou email) ao ter o portal ativado

---

## 2. BACKEND — ENDPOINT E SERVICE (NestJS)

### Endpoint
POST   /api/clients/:id/portal/ativar      → ativa o portal
POST   /api/clients/:id/portal/desativar   → desativa o portal
GET    /api/clients/:id/portal/status      → retorna status atual

### PortalService — lógica completa

```typescript
// Implemente o PortalService com os seguintes métodos:

async ativarPortal(clientId: number, operadorId: number) {
  // 1. Buscar cliente no Prisma — verificar se existe e está ativo
  // 2. Verificar se cliente tem email cadastrado
  //    - Se não tiver: throw BadRequestException com mensagem clara
  // 3. Verificar se portal já está ativo (idempotência)
  // 4. Usar $transaction do Prisma para garantir atomicidade:
  //    a. Criar usuário no Supabase Auth via Admin SDK:
  //       supabaseAdmin.auth.admin.createUser({
  //         email: cliente.email,
  //         password: gerarSenhaTemporaria(),  // 12 chars aleatórios
  //         email_confirm: true,  // pular confirmação de email
  //         user_metadata: {
  //           role: 'cliente',
  //           clientId: cliente.id,
  //           nome: cliente.nome,
  //         }
  //       })
  //    b. Atualizar client no Prisma:
  //       { supabaseId: supabaseUser.id, portalAtivo: true }
  //    c. Se Supabase falhar: NÃO atualizar o Prisma
  //    d. Se Prisma falhar: deletar usuário no Supabase 
  //       (supabaseAdmin.auth.admin.deleteUser)
  // 5. Enviar notificação ao cliente (WhatsApp + email) com:
  //    - Instruções de acesso
  //    - Senha temporária
  //    - Link do portal
  //    - Instrução para trocar a senha no primeiro acesso
  // 6. Registrar no AuditLog:
  //    { acao: 'PORTAL_ATIVADO', entidade: 'clients', 
  //      entidadeId: clientId, userId: operadorId }
  // 7. Retornar: { sucesso: true, senhaTemporaria, mensagem }
}

async desativarPortal(clientId: number, operadorId: number) {
  // 1. Buscar cliente — verificar se portal está ativo
  // 2. Banir no Supabase (não deletar):
  //    supabaseAdmin.auth.admin.updateUser(supabaseId, { banned: true })
  // 3. Atualizar Prisma: { portalAtivo: false }
  // 4. Registrar AuditLog: { acao: 'PORTAL_DESATIVADO' }
  // 5. Notificar cliente (opcional — configurável nas settings)
}

async reativarPortal(clientId: number, operadorId: number) {
  // 1. Verificar se supabaseId já existe (conta foi criada antes)
  // 2. Se sim: remover ban + setar portalAtivo = true
  // 3. Se não: chamar ativarPortal() (primeira vez)
}

// Gerar senha temporária segura
private gerarSenhaTemporaria(): string {
  // 12 caracteres: letras maiúsculas + minúsculas + números + especiais
  // Exemplo: "Xk#92mLp@4Nq"
  // Usar crypto.randomBytes para segurança criptográfica
}
```

---

## 3. SCHEMA PRISMA — CAMPOS ADICIONAIS

Adicione no model `Client` se ainda não existirem:

```prisma
model Client {
  // ... campos existentes ...
  supabaseId          String?   @unique @map("supabase_id")
  portalAtivo         Boolean   @default(false) @map("portal_ativo")
  portalAtivadoEm     DateTime? @map("portal_ativado_em")
  portalAtivadoPor    Int?      @map("portal_ativado_por")
  senhaTemporaria     Boolean   @default(false) @map("senha_temporaria")
  primeiroAcesso      Boolean   @default(true) @map("primeiro_acesso")
  mfaEnabled          Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount       Int       @default(0) @map("mfa_login_count")
  mfaDecidedAt        DateTime? @map("mfa_decided_at")
}
```

---

## 4. FRONTEND — TELA DE DETALHE DO CLIENTE (Next.js)

### Card "Acesso ao Portal" na página `/clientes/[id]`

Adicione um card na página de detalhe do cliente com as seguintes 
variações de estado:

#### Estado 1 — Cliente sem email cadastrado
┌─────────────────────────────────────────────┐
│ 🔒 Portal do Cliente                        │
│                                             │
│  ⚠️ Cliente sem email cadastrado            │
│  Adicione um email para habilitar o acesso  │
│  ao portal.                                 │
│                                             │
│  [ Editar cadastro ]                        │
└─────────────────────────────────────────────┘

#### Estado 2 — Portal inativo (cliente tem email)
┌─────────────────────────────────────────────┐
│ 🔒 Portal do Cliente          [ Inativo ]   │
│                                             │
│  Email: joao@email.com                      │
│  CPF:   123.456.789-00                      │
│                                             │
│  O cliente ainda não tem acesso ao portal.  │
│                                             │
│  [ ✅ Ativar acesso ao portal ]             │
└─────────────────────────────────────────────┘

#### Estado 3 — Portal ativo
┌─────────────────────────────────────────────┐
│ 🔓 Portal do Cliente          [ ✅ Ativo ]  │
│                                             │
│  Email: joao@email.com                      │
│  Ativado em: 19/05/2026 por Admin           │
│  Último acesso: 20/05/2026 às 14:30         │
│  MFA: ⚠️ Não configurado (3 logins usados) │
│                                             │
│  [ 🔑 Reenviar senha ]  [ ❌ Desativar ]   │
└─────────────────────────────────────────────┘

#### Estado 4 — Portal desativado (já teve acesso antes)
┌─────────────────────────────────────────────┐
│ 🔒 Portal do Cliente        [ Desativado ]  │
│                                             │
│  Desativado em: 18/05/2026 por Financeiro   │
│                                             │
│  [ ✅ Reativar acesso ]                     │
└─────────────────────────────────────────────┘

### Modal de confirmação de ativação
Ao clicar em "Ativar acesso ao portal", exibir modal de confirmação:
┌─────────────────────────────────────────────┐
│  Ativar Portal do Cliente                   │
│                                             │
│  Você está prestes a criar uma conta de     │
│  acesso para:                               │
│                                             │
│  👤 João da Silva                           │
│  📧 joao@email.com                          │
│  📱 (65) 99999-9999                         │
│                                             │
│  O cliente receberá:                        │
│  ✉️ Email com instruções de acesso          │
│  📱 WhatsApp com senha temporária           │
│                                             │
│  [ Cancelar ]   [ ✅ Confirmar ativação ]   │
└─────────────────────────────────────────────┘

### Modal de confirmação de desativação
┌─────────────────────────────────────────────┐
│  ⚠️ Desativar acesso ao portal              │
│                                             │
│  O cliente João da Silva perderá o acesso   │
│  imediatamente. O histórico será mantido.   │
│                                             │
│  Motivo (obrigatório):                      │
│  [ __________________________________ ]     │
│                                             │
│  [ Cancelar ]   [ ❌ Confirmar desativação ]│
└─────────────────────────────────────────────┘

---

## 5. MENSAGEM DE NOTIFICAÇÃO AO CLIENTE

### WhatsApp (Evolution API)
Olá, {nome}! 👋
Seu acesso ao portal da Lidera Financeira foi ativado.
🔐 Seus dados de acesso:

Usuário: {cpf_formatado} ou {email}
Senha temporária: {senha_temporaria}

🌐 Acesso: https://financeiro.lidera.app.br/portal
⚠️ Por segurança, troque sua senha no primeiro acesso.
Qualquer dúvida, estamos à disposição!

### Email (SMTP)
- Assunto: "Seu acesso ao Portal Lidera está pronto"
- Template HTML com:
  - Logo da empresa
  - Dados de acesso
  - Botão "Acessar o portal agora"
  - Instruções para troca de senha
  - Aviso de segurança (não compartilhar senha)

---

## 6. TELA DE PRIMEIRO ACESSO — PORTAL DO CLIENTE

Quando `primeiroAcesso = true`, após o login redirecionar para 
`/portal/primeiro-acesso`:
┌─────────────────────────────────────────────┐
│  Bem-vindo ao Portal Lidera! 🎉             │
│                                             │
│  Antes de continuar, defina sua senha       │
│  pessoal:                                   │
│                                             │
│  Nova senha: [ __________________ ]         │
│  Confirmar:  [ __________________ ]         │
│                                             │
│  Requisitos:                                │
│  ✅ Mínimo 8 caracteres                    │
│  ✅ Uma letra maiúscula                    │
│  ✅ Um número                              │
│  ✅ Um caractere especial                  │
│                                             │
│  [ Salvar minha senha e continuar ]         │
└─────────────────────────────────────────────┘

Após salvar: setar `primeiroAcesso = false` + exibir modal de MFA setup 
(com a contagem de 5 logins iniciando).

---

## 7. LISTAGEM DE CLIENTES — INDICADOR VISUAL

Na tabela de listagem `/clientes`, adicione uma coluna "Portal":
- 🟢 Ativo
- 🔴 Inativo  
- ⚫ Sem email (não pode ativar)

E no filtro de busca, adicione opção: 
"Status portal: Todos / Ativo / Inativo / Sem acesso"

---

## 8. ENTREGÁVEIS (nesta ordem)

1. Migration Prisma com os novos campos em `Client`
2. `PortalService` completo com todos os métodos
3. `PortalController` com os 3 endpoints protegidos por 
   `@Roles('admin', 'financeiro')`
4. Card "Acesso ao Portal" para a página de detalhe do cliente (Next.js + 
   Tailwind + shadcn/ui) com os 4 estados visuais
5. Modal de confirmação de ativação e desativação
6. Templates de mensagem (WhatsApp e email)
7. Tela de primeiro acesso `/portal/primeiro-acesso`
8. Coluna "Portal" na listagem de clientes com filtro

## REGRAS TÉCNICAS OBRIGATÓRIAS
- Usar `$transaction` do Prisma em TODA operação que envolva 
  Supabase Auth + banco simultaneamente
- Se a criação no Supabase falhar: não atualizar o banco
- Se a atualização do banco falhar: reverter a criação no Supabase
- Senha temporária gerada com `crypto.randomBytes` — nunca `Math.random()`
- Senha temporária NÃO deve ser salva no banco — apenas enviada ao cliente
- Registrar no `AuditLog` toda ativação, desativação e reenvio de senha
- Retornar mensagens de erro claras para o operador (não para o cliente)
- Proteger endpoint com `@Roles('admin', 'financeiro')` + 
  `SupabaseAuthGuard`

Por que esse prompt está completo:
Os quatro estados visuais do card garantem que o operador sempre saiba exatamente o que pode fazer com aquele cliente, sem precisar navegar para outra tela. A lógica de rollback com $transaction é crítica — sem ela, é possível criar o usuário no Supabase e o banco falhar, deixando uma conta órfã sem vínculo com nenhum cliente. E a senha temporária gerada com crypto.randomBytes segue o padrão criptográfico exigido para sistemas financeiros.

# Fase 3

Atue como Engenheiro de Software Sênior, Especialista em UX/UI para sistemas 
financeiros e Developer Frontend com expertise em Next.js. Preciso implementar 
o Portal do Cliente completo do SIAFI — sistema de factoring e empréstimos da 
Lidera Financeira.

O Portal do Cliente é uma área exclusiva onde o cliente final visualiza seus 
contratos, parcelas, realiza pagamentos via PIX e abre chamados de suporte.
É acessado pelo mesmo domínio do sistema, porém em rotas isoladas (/portal/*) 
com layout completamente separado do painel administrativo.

---

## 1. ARQUITETURA E ISOLAMENTO

### Estrutura de rotas (Next.js App Router)
src/app/
├── (auth)/
│   └── login/page.tsx              ← login unificado (admin + cliente)
│   └── portal/
│       ├── primeiro-acesso/page.tsx
│       ├── mfa-setup/page.tsx
│       └── mfa-challenge/page.tsx
└── (portal)/                       ← layout SEPARADO do dashboard
├── layout.tsx                  ← header simples + footer (sem sidebar)
└── portal/
├── page.tsx                ← home do portal (resumo)
├── contratos/
│   ├── page.tsx            ← lista de contratos
│   └── [id]/page.tsx       ← detalhe do contrato + parcelas
├── pagamentos/
│   ├── page.tsx            ← histórico de pagamentos
│   └── pix/[installmentId]/page.tsx ← gerar QR Code PIX
├── suporte/
│   ├── page.tsx            ← lista de tickets
│   └── novo/page.tsx       ← abrir novo ticket
└── perfil/page.tsx         ← dados pessoais + segurança

### Layout do portal (`(portal)/layout.tsx`)
- Header simples: logo Lidera + nome do cliente + botão "Sair"
- SEM sidebar administrativa
- Footer: "Lidera Financeira © 2026 | Suporte: (65) 99999-9999"
- Paleta: mesma do sistema (Slate/Dark) mas com identidade visual 
  voltada ao cliente — menos técnico, mais acolhedor
- Totalmente responsivo (mobile first — cliente acessa pelo celular)

### Segurança de isolamento
- Criar `ClientPortalGuard` separado do `RolesGuard` administrativo
- Todos os endpoints `/api/portal/*` validam que o `clientId` do JWT 
  corresponde EXATAMENTE aos dados solicitados
- NUNCA retornar dados de outros clientes — mesmo que o ID seja passado 
  na URL
- Exemplo de validação obrigatória:
```typescript
// Em TODO endpoint do portal:
if (loan.clientId !== req.user.clientId) {
  throw new ForbiddenException('Acesso negado.');
}
```

---

## 2. HOME DO PORTAL (`/portal`)

### Layout em cards — visão geral financeira do cliente
┌─────────────────────────────────────────────────────┐
│  Olá, João! 👋                    Maio 2026         │
│  Bem-vindo ao seu portal financeiro                 │
└─────────────────────────────────────────────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│ Contratos    │ │ Próx. parcela│ │ Total em aberto  │
│ ativos       │ │              │ │                  │
│    2         │ │ R$ 280,00    │ │ R$ 1.400,00      │
│              │ │ vence 25/05  │ │                  │
└──────────────┘ └──────────────┘ └──────────────────┘
┌─────────────────────────────────────────────────────┐
│  ⚠️ Parcela vencendo em 5 dias                      │
│  Contrato #2 · Parcela 3/5 · R$ 280,00             │
│  [ Pagar com PIX agora ]                            │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│  Últimas movimentações                              │
│  ─────────────────────────────────────────────────  │
│  ✅ Parcela 2/5 paga · R$ 280,00 · 10/05/2026      │
│  ✅ Parcela 1/5 paga · R$ 280,00 · 10/04/2026      │
└─────────────────────────────────────────────────────┘

### Alertas inteligentes na home
Exibir banners contextuais baseados na situação do cliente:
- 🔴 Parcela vencida há X dias → "Regularize sua situação"
- 🟡 Parcela vence em até 3 dias → "Pague agora com PIX"
- 🟢 Todas as parcelas em dia → "Parabéns! Você está em dia"
- ⚠️ MFA não configurado (com contagem) → "Proteja sua conta"

---

## 3. CONTRATOS (`/portal/contratos`)

### Lista de contratos
┌─────────────────────────────────────────────────────┐
│  Meus Contratos                                     │
├─────────────────────────────────────────────────────┤
│  Contrato #1                        [ ✅ Quitado ]  │
│  R$ 1.000,00 · 5 parcelas           Jan 2026        │
│  ████████████████████ 100%                          │
│                              [ Ver detalhes ]       │
├─────────────────────────────────────────────────────┤
│  Contrato #2                         [ 🔵 Ativo ]   │
│  R$ 1.400,00 · 5 parcelas            Mar 2026       │
│  ████████░░░░░░░░░░░░ 40%                           │
│  Próxima parcela: R$ 280,00 · 25/05/2026            │
│                              [ Ver detalhes ]       │
└─────────────────────────────────────────────────────┘

### Detalhe do contrato (`/portal/contratos/[id]`)
┌─────────────────────────────────────────────────────┐
│  ← Voltar    Contrato #2                            │
├─────────────────────────────────────────────────────┤
│  Valor emprestado:    R$ 1.000,00                   │
│  Total a pagar:       R$ 1.400,00                   │
│  Total pago:          R$   560,00                   │
│  Saldo restante:      R$   840,00                   │
│  Início:              01/03/2026                    │
│  Forma de pagamento:  PIX                           │
├─────────────────────────────────────────────────────┤
│  Parcelas                                           │
│  ─────────────────────────────────────────────────  │
│  1/5  R$ 280,00  01/04/26  ✅ Pago em 10/04/26     │
│  2/5  R$ 280,00  01/05/26  ✅ Pago em 10/05/26     │
│  3/5  R$ 280,00  01/06/26  🔵 Pendente             │
│       [ Pagar com PIX ]                             │
│  4/5  R$ 280,00  01/07/26  ⏳ Aguardando           │
│  5/5  R$ 280,00  01/08/26  ⏳ Aguardando           │
└─────────────────────────────────────────────────────┘

### Regras de exibição
- Mostrar APENAS contratos do cliente autenticado
- Status com cores: ✅ Pago (verde) · 🔵 Pendente (azul) · 
  🔴 Atrasado (vermelho) · ⏳ Futuro (cinza)
- Barra de progresso visual do contrato
- Botão "Pagar com PIX" apenas em parcelas `pendente` ou `atrasado`
- NÃO mostrar: valor investido, taxa de juros, observações internas

---

## 4. PAGAMENTO VIA PIX (`/portal/pagamentos/pix/[installmentId]`)

### Fluxo completo de geração de QR Code
┌─────────────────────────────────────────────────────┐
│  ← Voltar    Pagar com PIX                          │
├─────────────────────────────────────────────────────┤
│  Contrato #2 · Parcela 3/5                          │
│  Vencimento: 01/06/2026                             │
│                                                     │
│  Valor:  R$ 280,00                                  │
│                                                     │
│  ┌─────────────────────────┐                        │
│  │   [QR CODE IMAGE 200px] │                        │
│  │                         │                        │
│  └─────────────────────────┘                        │
│                                                     │
│  Copia e Cola:                                      │
│  [ 00020126580014br.gov.bcb... ]  [ 📋 Copiar ]    │
│                                                     │
│  ⏱️ QR Code válido por 30 minutos                   │
│  🔄 Gerar novo QR Code                              │
│                                                     │
│  ✅ Após o pagamento, a confirmação ocorre          │
│     automaticamente em até 5 minutos.               │
└─────────────────────────────────────────────────────┘

### Comportamento
- Ao entrar na página: verificar se já existe QR Code ativo para 
  essa parcela (não expirado) → reusar se existir
- Se não existir: chamar `POST /api/portal/pix/gerar` 
  automaticamente ao carregar a página
- Polling a cada 10 segundos em `GET /api/portal/pix/status/[pixId]`
- Quando status mudar para `aprovado`:
  - Parar o polling
  - Exibir tela de sucesso com animação
  - Redirecionar para `/portal/contratos/[id]` após 3 segundos
- Botão "Compartilhar" (Web Share API para mobile) para enviar o 
  código PIX via WhatsApp/SMS

### Tela de sucesso pós-pagamento
┌─────────────────────────────────────────────────────┐
│                                                     │
│         ✅  Pagamento confirmado!                   │
│                                                     │
│    Parcela 3/5 do Contrato #2                       │
│    R$ 280,00 · pago em 20/05/2026                   │
│                                                     │
│    Redirecionando em 3s...                          │
│                                                     │
│    [ Ver meus contratos ]                           │
│                                                     │
└─────────────────────────────────────────────────────┘

---

## 5. HISTÓRICO DE PAGAMENTOS (`/portal/pagamentos`)
┌─────────────────────────────────────────────────────┐
│  Histórico de Pagamentos                            │
│  Filtrar por: [ Todos os contratos ▼ ]  [ Mês ▼ ]  │
├─────────────────────────────────────────────────────┤
│  Maio 2026                                          │
│  10/05  Parcela 2/5 · Contrato #2  R$ 280,00  PIX  │
├─────────────────────────────────────────────────────┤
│  Abril 2026                                         │
│  10/04  Parcela 1/5 · Contrato #2  R$ 280,00  PIX  │
│  05/04  Parcela 5/5 · Contrato #1  R$ 200,00  PIX  │
└─────────────────────────────────────────────────────┘

---

## 6. SUPORTE (`/portal/suporte`)

### Lista de tickets
┌─────────────────────────────────────────────────────┐
│  Suporte                       [ + Novo chamado ]   │
├─────────────────────────────────────────────────────┤
│  #003  Dúvida sobre parcela     🟡 Aguardando       │
│        Aberto em 18/05/2026                         │
├─────────────────────────────────────────────────────┤
│  #002  Erro no QR Code PIX      ✅ Respondido       │
│        Aberto em 10/05/2026                         │
│        [ Ver resposta ]                             │
├─────────────────────────────────────────────────────┤
│  #001  Solicitação de renegoc.  ✅ Resolvido        │
│        Aberto em 01/04/2026                         │
└─────────────────────────────────────────────────────┘

### Novo ticket (`/portal/suporte/novo`)
┌─────────────────────────────────────────────────────┐
│  ← Voltar    Abrir chamado de suporte               │
├─────────────────────────────────────────────────────┤
│  Assunto:                                           │
│  [ Selecione ▼ ]                                    │
│    • Dúvida sobre parcela                           │
│    • Problema com pagamento PIX                     │
│    • Solicitação de renegociação                    │
│    • Atualização de dados cadastrais                │
│    • Outro                                          │
│                                                     │
│  Contrato relacionado (opcional):                   │
│  [ Selecione ▼ ]                                    │
│                                                     │
│  Mensagem:                                          │
│  [ _________________________________________ ]      │
│  [ _________________________________________ ]      │
│  [ _________________________________________ ]      │
│                                                     │
│  [ Enviar chamado ]                                 │
└─────────────────────────────────────────────────────┘

---

## 7. PERFIL E SEGURANÇA (`/portal/perfil`)
┌─────────────────────────────────────────────────────┐
│  Meu Perfil                                         │
├─────────────────────────────────────────────────────┤
│  👤 João da Silva                                   │
│  📧 joao@email.com                                  │
│  📱 (65) 99999-9999                                 │
│  🪪 123.456.789-00                                  │
│                                                     │
│  ⚠️ Para alterar seus dados, entre em contato       │
│     com a Lidera Financeira.                        │
├─────────────────────────────────────────────────────┤
│  Segurança                                          │
│  ─────────────────────────────────────────────────  │
│  Senha          [ Alterar senha ]                   │
│                                                     │
│  Google Authenticator                               │
│  [ ⚠️ Não configurado — Configurar agora ]          │
│  ou                                                 │
│  [ ✅ Ativo — Remover ]                             │
├─────────────────────────────────────────────────────┤
│  Notificações                                       │
│  ─────────────────────────────────────────────────  │
│  WhatsApp  🔔 Ativado    [ toggle ]                 │
│  Email     🔔 Ativado    [ toggle ]                 │
└─────────────────────────────────────────────────────┘

---

## 8. BACKEND — ENDPOINTS DO PORTAL (NestJS)

Todos os endpoints abaixo ficam em `/api/portal/*` e exigem 
`ClientPortalGuard` (role = cliente):
GET  /api/portal/home              → resumo: contratos ativos,
próxima parcela, saldo total,
últimos 5 pagamentos, alertas
GET  /api/portal/contratos         → lista contratos do cliente
GET  /api/portal/contratos/:id     → detalhe + parcelas (validar ownership)
GET  /api/portal/pagamentos        → histórico de pagamentos do cliente
POST /api/portal/pix/gerar         → { installmentId } → gera QR Code
GET  /api/portal/pix/status/:pixId → polling do status do pagamento
GET  /api/portal/suporte           → lista tickets do cliente
POST /api/portal/suporte           → abre novo ticket
GET  /api/portal/suporte/:id       → detalhe do ticket
GET  /api/portal/perfil            → dados do cliente (sem info sensível)
PATCH /api/portal/notificacoes     → atualiza preferências de notificação

### Dados que NUNCA devem ser retornados ao cliente
- `valorInvestido` (custo de capital da financeira)
- `taxaJuros` (taxa interna)
- `observacoes` internas dos contratos
- Dados de outros clientes
- Logs de auditoria internos
- Configurações do sistema

---

## 9. NOTIFICAÇÕES AUTOMÁTICAS PARA O CLIENTE

Adapte os Cron Jobs existentes para também notificar via portal:

### Badge de notificações no header do portal
- Contador de parcelas vencendo em 3 dias
- Tickets respondidos não lidos
- Implementar via Supabase Realtime:
```typescript
  supabase
    .channel('portal-notificacoes')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'support_tickets',
      filter: `client_id=eq.${clientId}`
    }, handleTicketUpdate)
    .subscribe()
```

---

## 10. ENTREGÁVEIS (nesta ordem)

1. Estrutura de pastas e arquivos do portal (`(portal)/layout.tsx` e 
   todas as páginas)
2. `ClientPortalService` com todos os métodos e validações de ownership
3. `ClientPortalController` com todos os endpoints
4. `ClientPortalGuard` isolado do guard administrativo
5. Home do portal com cards, barra de progresso e alertas inteligentes
6. Página de contratos (lista + detalhe + tabela de parcelas)
7. Página de PIX com QR Code, polling e tela de sucesso
8. Histórico de pagamentos com filtros
9. Módulo de suporte (lista + novo ticket)
10. Página de perfil com segurança e notificações
11. Hook `useRealtimePortal` para notificações em tempo real

## REGRAS TÉCNICAS OBRIGATÓRIAS
- TODA query do portal filtra por `clientId` do JWT — sem exceção
- Nunca expor campos financeiros internos (valorInvestido, taxaJuros)
- Polling do PIX com cleanup no `useEffect` (evitar memory leak)
- Layout completamente separado do painel admin (sem sidebar, sem 
  topbar administrativa)
- Mobile first — cliente acessa principalmente pelo celular
- Usar Supabase Realtime para notificações (tickets respondidos, 
  pagamento confirmado)
- Registrar no `AuditLog` toda geração de QR Code e acesso ao portal
- Idempotência no PIX: não gerar novo QR Code se já existir um 
  válido para a mesma parcela

Por que esse prompt está completo para um sistema financeiro:
O isolamento de rotas (portal)/* separado do (dashboard)/* garante que um cliente nunca veja nenhum fragmento da interface administrativa. O ClientPortalGuard com validação de ownership em cada endpoint é a camada crítica — mesmo que um cliente manipule a URL para tentar acessar o contrato de outro cliente, o backend rejeita imediatamente.
O polling do PIX com cleanup no useEffect evita que o cliente fique com requisições rodando em background depois de sair da página — detalhe técnico que causa bugs difíceis de rastrear em produção.