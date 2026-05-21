# SIAFI 2.0 — Fase 1: Autenticação, Roles e Painel do Consultor
# Versão revisada — Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md e 04_DATABASE.md.

---

```
Você é um Engenheiro de Software Sênior especializado em NestJS, Next.js e
Supabase Auth. Analise a documentação completa do SIAFI 2.0 e implemente a
Fase 1: sistema de autenticação restritivo, controle de acesso por roles e
o painel completo do Consultor.

═══════════════════════════════════════════════════════════════════
REGRA DE OURO
═══════════════════════════════════════════════════════════════════
O sistema NUNCA permite que um desconhecido crie conta ou acesse o sistema.
Todo acesso depende de um cadastro prévio feito pelo administrador.
O Supabase Auth é usado apenas como provedor de tokens — a fonte da verdade
de quem pode acessar é SEMPRE o banco de dados do SIAFI (tabelas `users`
e `clients`).

═══════════════════════════════════════════════════════════════════
PARTE 1 — ROLES DO SISTEMA
═══════════════════════════════════════════════════════════════════

O sistema possui 5 roles. A role `usuario` foi REMOVIDA do projeto.

┌──────────────┬────────────────────────────────────────────────────┐
│ Role         │ Descrição                                          │
├──────────────┼────────────────────────────────────────────────────┤
│ admin        │ Acesso total. Gerencia usuários, configurações,    │
│              │ auditoria e todas as funções financeiras.          │
├──────────────┼────────────────────────────────────────────────────┤
│ financeiro   │ Operação completa: clientes, empréstimos,          │
│              │ pagamentos, caixa, renegociações, relatórios.      │
│              │ Aprova/rejeita solicitações do consultor.          │
├──────────────┼────────────────────────────────────────────────────┤
│ consultor    │ Carteira própria de clientes. Cadastra clientes,   │
│              │ colhe documentação, registra intenção de           │
│              │ empréstimo, gera boletos, envia cobranças.         │
│              │ Envia solicitações de desconto/reparcelamento ao   │
│              │ financeiro. Comunica com todos os setores.         │
├──────────────┼────────────────────────────────────────────────────┤
│ caixa        │ Registra pagamentos e lançamentos de caixa.        │
│              │ Leitura de clientes para identificação.            │
├──────────────┼────────────────────────────────────────────────────┤
│ cliente      │ Acesso exclusivo ao Portal do Cliente (/portal/*). │
│              │ Vê seus contratos, parcelas e gera PIX.            │
└──────────────┴────────────────────────────────────────────────────┘

Atualize o enum no Prisma:
```prisma
enum UserRole {
  admin
  financeiro
  consultor
  caixa
  cliente
}
```

═══════════════════════════════════════════════════════════════════
PARTE 2 — SCHEMA PRISMA: NOVOS CAMPOS E VÍNCULOS
═══════════════════════════════════════════════════════════════════

### 2.1 — Model User (atualizado)
```prisma
model User {
  id                Int       @id @default(autoincrement())
  nome              String
  username          String    @unique
  password          String
  role              UserRole  @default(caixa)
  email             String?   @unique
  active            Boolean   @default(true)
  supabaseId        String?   @unique @map("supabase_id")
  mfaEnabled        Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount     Int       @default(0) @map("mfa_login_count")
  mfaDecidedAt      DateTime? @map("mfa_decided_at")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  auditLogs         AuditLog[]
  transactions      Transaction[]
  clientesCarteira  Client[]   @relation("ClienteConsultor")
  solicitacoes      ConsultorSolicitacao[]

  @@map("users")
}
```

### 2.2 — Model Client (atualizado — vínculo com consultor)
Adicione os seguintes campos ao model Client existente:
```prisma
model Client {
  // ... todos os campos existentes ...

  // Novos campos:
  supabaseId          String?   @unique @map("supabase_id")
  portalAtivo         Boolean   @default(false) @map("portal_ativo")
  portalAtivadoEm     DateTime? @map("portal_ativado_em")
  portalAtivadoPor    Int?      @map("portal_ativado_por")
  senhaTemporaria     Boolean   @default(false) @map("senha_temporaria")
  primeiroAcesso      Boolean   @default(true) @map("primeiro_acesso")
  mfaEnabled          Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount       Int       @default(0) @map("mfa_login_count")
  mfaDecidedAt        DateTime? @map("mfa_decided_at")

  // Vínculo com consultor responsável (nullable — cliente pode existir sem consultor)
  consultorId         Int?      @map("consultor_id")
  consultor           User?     @relation("ClienteConsultor", fields: [consultorId], references: [id])

  @@map("clients")
}
```

### 2.3 — Model ConsultorSolicitacao (NOVO)
Tabela para solicitações enviadas pelo consultor ao financeiro:
```prisma
model ConsultorSolicitacao {
  id              Int       @id @default(autoincrement())
  consultorId     Int       @map("consultor_id")
  clientId        Int       @map("client_id")
  loanId          Int?      @map("loan_id")
  tipo            String    @db.VarChar(30)
  // tipos: 'desconto' | 'reparcelamento' | 'intencao_emprestimo' | 'outro'
  descricao       String    @db.Text
  valorSolicitado Decimal?  @db.Decimal(10,2) @map("valor_solicitado")
  status          String    @default("pendente") @db.VarChar(20)
  // status: 'pendente' | 'aprovado' | 'rejeitado'
  respostaFinanceiro String? @db.Text @map("resposta_financeiro")
  respondidoPor   Int?      @map("respondido_por")
  respondidoEm    DateTime? @map("respondido_em")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  consultor   User    @relation(fields: [consultorId], references: [id])
  client      Client  @relation(fields: [clientId], references: [id])
  loan        Loan?   @relation(fields: [loanId], references: [id])

  @@index([consultorId])
  @@index([clientId])
  @@index([status])
  @@map("consultor_solicitacoes")
}
```

### 2.4 — Model IntencaoEmprestimo (NOVO)
Intenção de empréstimo registrada pelo consultor antes da aprovação:
```prisma
model IntencaoEmprestimo {
  id              Int       @id @default(autoincrement())
  clientId        Int       @map("client_id")
  consultorId     Int       @map("consultor_id")
  valorSolicitado Decimal   @db.Decimal(10,2) @map("valor_solicitado")
  numeroParcelas  Int       @map("numero_parcelas")
  finalidade      String?   @db.Text
  status          String    @default("aguardando") @db.VarChar(20)
  // status: 'aguardando' | 'aprovado' | 'rejeitado' | 'convertido'
  observacoes     String?   @db.Text
  aprovadoPor     Int?      @map("aprovado_por")
  aprovadoEm      DateTime? @map("aprovado_em")
  loanId          Int?      @unique @map("loan_id")
  // loan_id preenchido quando convertido em empréstimo real
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  client      Client  @relation(fields: [clientId], references: [id])
  consultor   User    @relation(fields: [consultorId], references: [id])

  @@index([consultorId])
  @@index([status])
  @@map("intencoes_emprestimo")
}
```

═══════════════════════════════════════════════════════════════════
PARTE 3 — FLUXO DE AUTENTICAÇÃO (ATUALIZADO)
═══════════════════════════════════════════════════════════════════

### 3.1 — Roles operacionais (admin, financeiro, consultor, caixa)
- Cadastro EXCLUSIVAMENTE pelo Administrador no painel Users
- O admin informa: nome, username, email, role e senha inicial
- Sistema cria no Supabase Auth via Admin SDK + vincula supabaseId no Prisma
- Email no Supabase Auth: `${username}@siafi.local` (fictício — não enviar confirmação)
- Salvar role e prismaId em `app_metadata` (não user_metadata — só backend grava app_metadata)
  Exemplo: `{ email: username+'@siafi.local', app_metadata: { role, prismaId: user.id } }`
- Login: username+senha OU email+senha
- AuthService.login() deve seguir exatamente:
  1. Buscar user por username + validar bcrypt
  2. Se supabaseId == null: criar no Supabase Auth (auto-sync) com email fictício
  3. `supabase.auth.signInWithPassword({ email: username+'@siafi.local', password })`
  4. Verificar AAL: se MFA ativo e AAL < aal2 → retornar `{ needsMfa: true, factorId }`
  5. Retornar `{ accessToken (JWT Supabase), user }` — refreshToken em httpOnly cookie
  6. Frontend AuthContext usa `completeMfa(factorId, code)` para elevar para aal2
- Login Google: SOMENTE se email Google = email em `users`. Nunca criar
  registro automaticamente via OAuth.
- Role `consultor`: MFA obrigatório imediato (igual a admin e financeiro)
  — consultor lida com dados sensíveis de clientes

### 3.2 — Role CLIENTE
- Cadastro pelo operador (admin/financeiro/consultor) na tabela `clients`
- Portal ativado manualmente via "Habilitar acesso ao portal"
- Login por: CPF+senha, email+senha ou Google OAuth (email idêntico)
- Nunca acessar dados de outro cliente

### 3.3 — JwtAuthGuard (dupla verificação — estender o guard existente)
```typescript
// ATENÇÃO: esta lógica deve ser adicionada DENTRO do JwtAuthGuard existente
  // NÃO criar um novo guard — estender o validate() do JwtAuthGuard atual
  async validateUser(supabaseId: string, email: string) {
  // 1. Verificar em `users` (roles operacionais)
  const operador = await prisma.user.findFirst({
    where: { supabaseId, active: true }
  });
  if (operador) return { ...operador, tipo: 'operador' };

  // 2. Verificar em `clients` (role cliente)
  const cliente = await prisma.client.findFirst({
    where: { supabaseId, active: true }
  });
  if (cliente) return { ...cliente, role: 'cliente', tipo: 'cliente' };

  // 3. Não encontrado — acesso negado + registrar tentativa no AuditLog
  await prisma.auditLog.create({
    data: { acao: 'ACESSO_NEGADO_DESCONHECIDO', dados: { supabaseId, email } }
  });
  throw new ForbiddenException(
    'Conta não autorizada. Acesso restrito a usuários cadastrados.'
  );
}
```

### 3.4 — MFA por role
| Role       | Comportamento MFA                                    |
|------------|------------------------------------------------------|
| admin      | Obrigatório imediato — sem prazo de 5 logins         |
| financeiro | Obrigatório imediato — sem prazo de 5 logins         |
| consultor  | Obrigatório imediato — sem prazo de 5 logins         |
| caixa      | Prazo de 5 logins para configurar                    |
| cliente    | Prazo de 5 logins para configurar                    |

═══════════════════════════════════════════════════════════════════
PARTE 4 — PAINEL DO CONSULTOR (MÓDULO COMPLETO)
═══════════════════════════════════════════════════════════════════

### 4.1 — Princípio de isolamento da carteira
O consultor enxerga APENAS os clientes onde `client.consultorId = user.id`.
Toda query do ConsultorService deve filtrar por `consultorId` do JWT.
Nunca retornar clientes de outros consultores, mesmo que o ID seja passado
diretamente na URL.

### 4.2 — Rotas do painel do consultor (Next.js)
```
src/app/(dashboard)/
└── consultor/
    ├── page.tsx                    ← dashboard do consultor (KPIs da carteira)
    ├── minha-carteira/
    │   ├── page.tsx                ← lista de clientes da carteira
    │   └── [clientId]/page.tsx     ← detalhe do cliente + contratos
    ├── clientes/
    │   ├── novo/page.tsx           ← cadastrar novo cliente + upload docs
    │   └── [id]/editar/page.tsx    ← editar cliente
    ├── intencoes/
    │   ├── page.tsx                ← lista de intenções de empréstimo
    │   ├── nova/page.tsx           ← registrar nova intenção
    │   └── [id]/page.tsx           ← detalhe da intenção
    ├── solicitacoes/
    │   ├── page.tsx                ← solicitações enviadas ao financeiro
    │   └── nova/page.tsx           ← enviar solicitação (desconto/reparcel.)
    ├── cobrancas/
    │   └── page.tsx                ← parcelas em atraso da carteira
    └── comunicados/
        └── page.tsx                ← mensagens recebidas do financeiro/admin
```

### 4.3 — Dashboard do Consultor (`/consultor`)
Cards KPI exclusivos da carteira do consultor:
```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Meus Clientes    │ │ Contratos Ativos │ │ Em Atraso        │
│      12          │ │       8          │ │       2          │
└──────────────────┘ └──────────────────┘ └──────────────────┘
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Intenções        │ │ Solicitações     │ │ Comissão Mês     │
│ Aguardando: 3    │ │ Pendentes: 1     │ │  R$ 1.240,00     │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

Seções abaixo dos cards:
- Lista de clientes com parcela vencendo nos próximos 3 dias
- Últimas solicitações enviadas ao financeiro (com status)
- Intenções de empréstimo aguardando aprovação

### 4.4 — Minha Carteira (`/consultor/minha-carteira`)
Lista de clientes vinculados ao consultor logado:
- Busca por nome/CPF
- Filtro por status do contrato: Todos / Ativos / Atrasados / Quitados
- Coluna "Situação": badge colorido com status do contrato mais recente
- Botões por linha: Ver cliente / Registrar cobrança / Nova intenção

### 4.5 — Cadastro de Cliente pelo Consultor
O consultor pode cadastrar novos clientes com as mesmas regras do admin,
porém:
- `consultorId` é preenchido AUTOMATICAMENTE com o ID do consultor logado
- O consultor NÃO pode alterar o `consultorId` de um cliente
- Upload de documentos (RG, comprovante renda, foto) via Supabase Storage
- Campos obrigatórios para intenção de empréstimo: igual ao formulário
  padrão mais o campo "Finalidade do empréstimo"

### 4.6 — Intenção de Empréstimo (`/consultor/intencoes`)
Fluxo da intenção:
```
Consultor registra intenção
         ↓
Status: "aguardando"
         ↓
Financeiro/Admin recebe notificação
         ↓
   ┌─────┴─────┐
Aprova       Rejeita
   ↓             ↓
Status:       Status:
"aprovado"   "rejeitado"
   ↓
Consultor/Financeiro converte em
empréstimo real (Loan) →
Status: "convertido" + loanId preenchido
```

Formulário de nova intenção:
```
┌─────────────────────────────────────────────────────┐
│  Nova Intenção de Empréstimo                        │
├─────────────────────────────────────────────────────┤
│  Cliente:          [ Selecione da sua carteira ▼ ]  │
│  Valor solicitado: [ R$ _____________ ]             │
│  Nº de parcelas:   [ ___ ]                          │
│  Finalidade:       [ _______________________ ]      │
│  Observações:      [ _______________________ ]      │
│                    [ _______________________ ]      │
│                                                     │
│  [ Cancelar ]          [ Enviar para aprovação ]    │
└─────────────────────────────────────────────────────┘
```

### 4.7 — Solicitações ao Financeiro (`/consultor/solicitacoes`)
O consultor pode enviar solicitações formais ao setor financeiro:

Tipos de solicitação:
- `desconto`: solicitar desconto em parcela(s) para cliente
- `reparcelamento`: solicitar novo parcelamento de dívida
- `intencao_emprestimo`: formalizar pedido de novo empréstimo
- `outro`: comunicado livre com descrição

Formulário:
```
┌─────────────────────────────────────────────────────┐
│  Nova Solicitação ao Financeiro                     │
├─────────────────────────────────────────────────────┤
│  Tipo:     [ Selecione ▼ ]                          │
│  Cliente:  [ Selecione da sua carteira ▼ ]          │
│  Contrato: [ Selecione ▼ ] (opcional)               │
│  Valor:    [ R$ ________ ] (se aplicável)           │
│  Descrição:[ _____________________________________ ] │
│            [ _____________________________________ ] │
│                                                     │
│  [ Cancelar ]              [ Enviar solicitação ]   │
└─────────────────────────────────────────────────────┘
```

Status das solicitações:
- 🟡 Pendente — aguardando análise do financeiro
- ✅ Aprovada — financeiro aprovou, com resposta
- ❌ Rejeitada — financeiro rejeitou, com justificativa

### 4.8 — Cobranças da Carteira (`/consultor/cobrancas`)
Lista de parcelas atrasadas dos clientes da carteira do consultor:
- Filtro por dias em atraso: todos / 1-30 / 31-60 / 60+
- Por linha: nome cliente, contrato, dias em atraso, valor, botões:
  - "Enviar WhatsApp" → enfileira job de cobrança manual
  - "Gerar PIX" → gera QR Code para a parcela
  - "Registrar contato" → abre modal para anotar tentativa de cobrança

Modal "Registrar contato":
```
┌─────────────────────────────────────────────────────┐
│  Registrar tentativa de contato                     │
├─────────────────────────────────────────────────────┤
│  Canal:  ○ WhatsApp  ○ Ligação  ○ Presencial        │
│  Resultado:                                         │
│  ○ Prometeu pagar em: [ data ]                      │
│  ○ Não atendeu                                      │
│  ○ Número incorreto                                 │
│  ○ Outro: [ ________ ]                              │
│  Observação: [ ____________________________ ]       │
│                                                     │
│  [ Cancelar ]              [ Salvar contato ]       │
└─────────────────────────────────────────────────────┘
```

Salvar em nova tabela `cobranca_contatos`:
```prisma
model CobrancaContato {
  id              Int      @id @default(autoincrement())
  installmentId   Int      @map("installment_id")
  clientId        Int      @map("client_id")
  consultorId     Int      @map("consultor_id")
  canal           String   @db.VarChar(20)
  resultado       String   @db.VarChar(50)
  prometeuPagarEm DateTime? @map("prometeu_pagar_em")
  observacao      String?  @db.Text
  createdAt       DateTime @default(now()) @map("created_at")

  @@index([installmentId])
  @@index([clientId])
  @@index([consultorId])
  @@map("cobranca_contatos")
}
```

═══════════════════════════════════════════════════════════════════
PARTE 5 — PERMISSÕES POR RECURSO (ATUALIZADA)
═══════════════════════════════════════════════════════════════════

Matriz completa de permissões:

| Recurso                  | admin | financeiro | consultor    | caixa |
|--------------------------|-------|------------|--------------|-------|
| Dashboard geral          | ✅    | ✅         | ✅ (carteira)| ✅    |
| Clientes (todos)         | ✅    | ✅         | ❌           | 👁️ ler|
| Clientes (carteira)      | ✅    | ✅         | ✅           | ❌    |
| Cadastrar cliente        | ✅    | ✅         | ✅           | ❌    |
| Empréstimos (todos)      | ✅    | ✅         | ❌           | ❌    |
| Criar empréstimo         | ✅    | ✅         | ❌           | ❌    |
| Intenção de empréstimo   | ✅    | ✅ aprovar | ✅ criar     | ❌    |
| Solicitações consultor   | ✅    | ✅ aprovar | ✅ criar     | ❌    |
| Pagamentos               | ✅    | ✅         | ❌           | ✅    |
| Gerar boleto/PIX         | ✅    | ✅         | ✅ (carteira)| ❌    |
| Cobrança WhatsApp        | ✅    | ✅         | ✅ (carteira)| ❌    |
| Caixa                    | ✅    | ✅         | ❌           | ✅    |
| Renegociações            | ✅    | ✅         | ❌ (solicita)| ❌    |
| Relatórios gerais        | ✅    | ✅         | ✅ (carteira)| ❌    |
| Usuários                 | ✅    | ❌         | ❌           | ❌    |
| Configurações            | ✅    | ❌         | ❌           | ❌    |
| Auditoria                | ✅    | ❌         | ❌           | ❌    |

### RolesGuard — aplicação nos controllers

```typescript
// Exemplos de proteção nos controllers:

// ConsultorController — acesso à carteira
@Roles('admin', 'financeiro', 'consultor')
@Get('minha-carteira')
getCarteira(@CurrentUser() user) {
  // Se consultor: filtrar por consultorId = user.id
  // Se admin/financeiro: retornar todos
}

// IntencaoEmprestimoController
@Roles('admin', 'financeiro', 'consultor')
@Post('intencoes')
criarIntencao(@CurrentUser() user, @Body() dto) {
  // Se consultor: dto.consultorId = user.id (forçado)
  // Se admin/financeiro: pode criar para qualquer consultor
}

// Aprovação de intenção — apenas financeiro e admin
@Roles('admin', 'financeiro')
@Patch('intencoes/:id/aprovar')
aprovarIntencao() {}

// SolicitacoesController — consultor cria, financeiro aprova
@Roles('admin', 'financeiro', 'consultor')
@Post('solicitacoes')
criarSolicitacao(@CurrentUser() user, @Body() dto) {
  if (user.role === 'consultor') {
    dto.consultorId = user.id; // forçado
  }
}
```

═══════════════════════════════════════════════════════════════════
PARTE 6 — SIDEBAR ATUALIZADA (FRONTEND)
═══════════════════════════════════════════════════════════════════

Atualize `src/components/layout/sidebar.tsx` com os novos grupos:

```typescript
const menuGroups = [
  {
    label: 'Principal',
    items: [{ label: 'Dashboard', href: '/dashboard', roles: ['admin','financeiro','consultor','caixa'] }]
  },
  {
    label: 'Minha Carteira',         // visível apenas para consultor
    roles: ['consultor'],
    items: [
      { label: 'Dashboard', href: '/consultor', roles: ['consultor'] },
      { label: 'Minha Carteira', href: '/consultor/minha-carteira', roles: ['consultor'] },
      { label: 'Intenções', href: '/consultor/intencoes', roles: ['consultor'] },
      { label: 'Solicitações', href: '/consultor/solicitacoes', roles: ['consultor'] },
      { label: 'Cobranças', href: '/consultor/cobrancas', roles: ['consultor'] },
    ]
  },
  {
    label: 'Operacional',
    roles: ['admin','financeiro','caixa'],
    items: [
      { label: 'Clientes', href: '/clientes', roles: ['admin','financeiro','caixa'] },
      { label: 'Empréstimos', href: '/emprestimos', roles: ['admin','financeiro'] },
      { label: 'Parcelas', href: '/parcelas', roles: ['admin','financeiro','caixa'] },
      { label: 'Pagamentos', href: '/pagamentos', roles: ['admin','financeiro','caixa'] },
      { label: 'Inadimplentes', href: '/inadimplentes', roles: ['admin','financeiro'] },
      { label: 'Intenções', href: '/intencoes', roles: ['admin','financeiro'] },
      { label: 'Solicitações', href: '/solicitacoes', roles: ['admin','financeiro'] },
    ]
  },
  {
    label: 'Financeiro',
    roles: ['admin','financeiro','caixa'],
    items: [
      { label: 'Caixa', href: '/caixa', roles: ['admin','financeiro','caixa'] },
      { label: 'Renegociações', href: '/renegociacoes', roles: ['admin','financeiro'] },
      { label: 'Conciliação', href: '/conciliacao', roles: ['admin','financeiro'] },
      { label: 'PIX', href: '/pix', roles: ['admin','financeiro'] },
    ]
  },
  {
    label: 'Relatórios',
    roles: ['admin','financeiro','consultor'],
    items: [
      { label: 'Relatórios', href: '/relatorios', roles: ['admin','financeiro','consultor'] },
    ]
  },
  {
    label: 'Comunicação',
    roles: ['admin','financeiro','consultor','caixa'],
    items: [
      { label: 'Notificações', href: '/notificacoes', roles: ['admin','financeiro','consultor','caixa'] },
      { label: 'Suporte', href: '/suporte', roles: ['admin','financeiro','consultor','caixa'] },
    ]
  },
  {
    label: 'Administração',
    roles: ['admin'],
    items: [
      { label: 'Usuários', href: '/usuarios', roles: ['admin'] },
      { label: 'Configurações', href: '/configuracoes', roles: ['admin'] },
      { label: 'Auditoria', href: '/auditoria', roles: ['admin'] },
    ]
  },
]
```

═══════════════════════════════════════════════════════════════════
PARTE 7 — NOTIFICAÇÕES PARA O FINANCEIRO
═══════════════════════════════════════════════════════════════════

Quando um consultor enviar intenção de empréstimo ou solicitação:
1. Criar registro na tabela `notifications` com tipo `interno`
2. Destinatário: todos os usuários com role `financeiro` e `admin`
3. Exibir badge de notificação no menu lateral para financeiro/admin
4. Implementar via Supabase Realtime:
```typescript
supabase
  .channel('solicitacoes-financeiro')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'consultor_solicitacoes',
    filter: `status=eq.pendente`
  }, handleNovaSolicitacao)
  .subscribe()
```

═══════════════════════════════════════════════════════════════════
PARTE 8 — ENTREGÁVEIS DA FASE 1 (em ordem)
═══════════════════════════════════════════════════════════════════

1.  Migration Prisma com TODOS os novos campos e models:
    - User (supabaseId, mfa*, email)
    - Client (supabaseId, portal*, mfa*, consultorId)
    - ConsultorSolicitacao (novo model)
    - IntencaoEmprestimo (novo model)
    - CobrancaContato (novo model)
    - Enum UserRole sem `usuario`, com `consultor`

2.  AuthService atualizado:
    - loginComEmailOuCpf(identificador, senha)
    - loginComGoogle(token) com validação restritiva
    - verificarPrazoMfa(userId, role) — consultor obrigatório imediato
    - setupMfa / confirmarMfa / challengeMfa

3.  JwtAuthGuard com dupla verificação + AuditLog em acesso negado

4.  ConsultorModule completo:
    - ConsultorService (todos os métodos com filtro por consultorId)
    - ConsultorController (endpoints abaixo)
    - Validação de ownership em todo endpoint

5.  Endpoints do consultor:
    ```
    GET    /api/consultor/dashboard
    GET    /api/consultor/carteira
    GET    /api/consultor/carteira/:clientId
    POST   /api/clients                    (cria com consultorId automático)
    POST   /api/consultor/intencoes
    GET    /api/consultor/intencoes
    GET    /api/consultor/intencoes/:id
    POST   /api/consultor/solicitacoes
    GET    /api/consultor/solicitacoes
    GET    /api/consultor/cobrancas
    POST   /api/consultor/cobrancas/:installmentId/contato
    POST   /api/consultor/cobrancas/:installmentId/whatsapp
    GET    /api/pix/gerar/:installmentId   (com validação de carteira)
    ```

6.  Endpoints do financeiro para aprovação:
    ```
    GET    /api/intencoes                  (todas pendentes)
    PATCH  /api/intencoes/:id/aprovar
    PATCH  /api/intencoes/:id/rejeitar
    GET    /api/solicitacoes              (todas pendentes)
    PATCH  /api/solicitacoes/:id/aprovar
    PATCH  /api/solicitacoes/:id/rejeitar
    ```

7.  Sidebar atualizada com grupos condicionais por role

8.  Painel do consultor (Next.js — todas as páginas listadas no item 4.2)

9.  Tela de login unificada (CPF/email + Google + detecção automática)

10. Telas de MFA (setup + challenge + modal de prazo)

11. Painel do financeiro atualizado com aba "Solicitações do Consultor"

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════════
- Todo endpoint do ConsultorModule filtra por consultorId do JWT
- $transaction do Prisma em toda criação de usuário no Supabase + banco
- Nunca expor SUPABASE_SERVICE_ROLE_KEY no frontend
- Consultor NÃO pode alterar o consultorId de um cliente existente
- Consultor NÃO pode ver clientes de outros consultores
- Registrar no AuditLog: toda criação de intenção, solicitação e contato
- Mensagens de erro genéricas ao usuário (nunca revelar se email existe)
- CPF armazenado apenas como números (sem formatação)
- Seguir LGPD: documentos de clientes no Supabase Storage (bucket privado)
```
