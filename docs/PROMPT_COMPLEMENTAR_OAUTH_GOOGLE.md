# SIAFI 2.0 — Prompt Complementar
# Blindagem OAuth Google — Zero Registro Espontâneo
# Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md e 04_DATABASE.md.
As Fases 1, 2 e 3 já foram implementadas. Este prompt corrige e reforça
um ponto crítico de segurança que precisa ser revisado.

---

```
Você é um Engenheiro de Software Sênior especializado em segurança de
autenticação com Supabase Auth e Next.js. As Fases 1, 2 e 3 do SIAFI já
foram implementadas. Preciso que você revise e corrija especificamente
o fluxo de autenticação via Google OAuth para garantir uma regra
inviolável de negócio.

═══════════════════════════════════════════════════════════════════
O PROBLEMA QUE PRECISA SER RESOLVIDO
═══════════════════════════════════════════════════════════════════

O Supabase Auth, por padrão, cria uma conta nova automaticamente quando
qualquer pessoa clica em "Entrar com Google" — mesmo que essa pessoa
não tenha nenhum vínculo com o sistema.

Isso é inadmissível para o SIAFI. O sistema financeiro da Lidera não
permite auto-registro de nenhuma espécie. Toda conta precisa ser criada
por um operador autorizado antes de qualquer tentativa de acesso.

O comportamento correto é:

  CENÁRIO PROIBIDO (deve ser bloqueado):
  → João da Silva nunca usou o SIAFI
  → João clica em "Entrar com Google"
  → Supabase cria uma conta para João automaticamente
  → João acessa o sistema sem nunca ter sido cadastrado
  ❌ ISTO NÃO PODE ACONTECER

  CENÁRIO PERMITIDO — Cliente:
  → Maria é cliente da Lidera
  → O Consultor cadastrou Maria na tabela `clients`
  → O Consultor ou Admin ativou o portal de Maria
    (POST /api/clients/:id/portal/ativar)
  → Ao ativar, o sistema criou a conta dela no Supabase Auth com o
    email real dela e salvou o supabaseId em clients.supabase_id
  → Maria clica em "Entrar com Google" usando o mesmo email
  → O email da conta Google bate com clients.email
  → O supabaseId já existe em clients.supabase_id
  ✅ ACESSO LIBERADO — Maria vai para o portal

  CENÁRIO PERMITIDO — Operador (admin, financeiro, consultor, caixa):
  → Pedro é operador da Lidera
  → O Admin criou a conta de Pedro na tabela `users`
  → Ao criar, o sistema registrou Pedro no Supabase Auth com email
    fictício pedro@siafi.local e salvou o supabaseId em users.supabase_id
  → O Admin também salvou o email real de Pedro em users.email
  → Pedro clica em "Entrar com Google" usando seu email real
  → O email da conta Google bate com users.email
  ✅ ACESSO LIBERADO — Pedro vai para o dashboard

  CENÁRIO BLOQUEADO — Desconhecido:
  → Carlos nunca foi cadastrado no SIAFI
  → Carlos clica em "Entrar com Google"
  → Supabase cria uma conta para Carlos automaticamente
  → O sistema detecta que o email de Carlos não existe
    nem em users.email nem em clients.email
  → O sistema DELETA imediatamente a conta Carlos do Supabase Auth
  → Carlos recebe a mensagem: "Acesso não autorizado."
  → Carlos é redirecionado para /login com erro visível
  ❌ BLOQUEADO — sem acesso

═══════════════════════════════════════════════════════════════════
PARTE 1 — CONFIGURAÇÃO DO SUPABASE (painel)
═══════════════════════════════════════════════════════════════════

Explique ao desenvolvedor que antes de qualquer código é necessário
configurar no painel do Supabase:

Authentication → Settings → "Allow new users to sign up"
→ DESATIVAR esta opção

Isso impede que o Supabase crie contas novas via qualquer provider
(Google, email, etc.) para pessoas que não foram pré-cadastradas
pelo Admin SDK.

ATENÇÃO: esta configuração sozinha não é suficiente porque o Admin SDK
(service_role) bypassa esta restrição. Por isso o código de validação
abaixo ainda é obrigatório como segunda camada de segurança.

═══════════════════════════════════════════════════════════════════
PARTE 2 — BACKEND: ENDPOINT DE VALIDAÇÃO (NestJS)
═══════════════════════════════════════════════════════════════════

Crie o endpoint POST /api/auth/validate-google no AuthController.
Este endpoint é chamado pelo frontend logo após o Supabase processar
o callback do Google OAuth, antes de qualquer redirecionamento.

### 2.1 — DTO

```typescript
// src/modules/auth/dto/validate-google.dto.ts
import { IsEmail, IsString, IsUUID } from 'class-validator';

export class ValidateGoogleDto {
  @IsEmail()
  email: string;

  @IsUUID()
  supabaseUserId: string;
}
```

### 2.2 — AuthService.validateGoogleOAuth()

```typescript
async validateGoogleOAuth(email: string, supabaseUserId: string): Promise<{
  tipo: 'operador' | 'cliente';
  role: string;
  prismaId: number;
}> {

  // 1. Verificar em `users` — roles operacionais
  const operador = await this.prisma.user.findFirst({
    where: { email, active: true },
    select: { id: true, role: true, supabaseId: true, nome: true }
  });

  if (operador) {
    // 1a. Vincular supabaseId se for o primeiro login com Google
    if (!operador.supabaseId) {
      await this.prisma.user.update({
        where: { id: operador.id },
        data: { supabaseId: supabaseUserId }
      });
      // Sincronizar app_metadata no Supabase Auth
      await this.supabase.admin.auth.admin.updateUserById(supabaseUserId, {
        app_metadata: {
          role: operador.role,
          prismaId: operador.id,
          tipo: 'operador',
        }
      });
    }

    // 1b. supabaseId já existe mas não bate com este token — conta suspeita
    if (operador.supabaseId && operador.supabaseId !== supabaseUserId) {
      await this.revogarEAuditar(supabaseUserId, email, 'GOOGLE_SUPABASE_ID_MISMATCH');
      throw new ForbiddenException('Acesso não autorizado.');
    }

    return { tipo: 'operador', role: operador.role, prismaId: operador.id };
  }

  // 2. Verificar em `clients` — role cliente
  const cliente = await this.prisma.client.findFirst({
    where: { email, active: true, portalAtivo: true },
    select: { id: true, supabaseId: true, nome: true }
  });

  if (cliente) {
    // 2a. Vincular supabaseId se for o primeiro login com Google
    if (!cliente.supabaseId) {
      await this.prisma.client.update({
        where: { id: cliente.id },
        data: { supabaseId: supabaseUserId }
      });
      await this.supabase.admin.auth.admin.updateUserById(supabaseUserId, {
        app_metadata: {
          role: 'cliente',
          clientId: cliente.id,
          tipo: 'cliente',
        }
      });
    }

    // 2b. supabaseId já existe mas não bate — conta suspeita
    if (cliente.supabaseId && cliente.supabaseId !== supabaseUserId) {
      await this.revogarEAuditar(supabaseUserId, email, 'GOOGLE_SUPABASE_ID_MISMATCH_CLIENT');
      throw new ForbiddenException('Acesso não autorizado.');
    }

    return { tipo: 'cliente', role: 'cliente', prismaId: cliente.id };
  }

  // 3. Email não encontrado em nenhuma tabela — desconhecido
  // Deletar IMEDIATAMENTE a conta que o Supabase criou automaticamente
  await this.revogarEAuditar(supabaseUserId, email, 'GOOGLE_EMAIL_NAO_CADASTRADO');
  throw new ForbiddenException(
    'Acesso não autorizado. Esta conta Google não está cadastrada no sistema.'
  );
}

// Método auxiliar: deletar do Supabase + registrar no AuditLog
private async revogarEAuditar(
  supabaseUserId: string,
  email: string,
  motivo: string
): Promise<void> {
  // Deletar a conta do Supabase Auth (não deixar rastro)
  try {
    await this.supabase.admin.auth.admin.deleteUser(supabaseUserId);
  } catch (err) {
    // Log de erro mas não relançar — o 403 já será lançado pelo caller
    console.error(`Falha ao deletar conta Supabase ${supabaseUserId}:`, err);
  }

  // Registrar no AuditLog para rastreabilidade
  await this.prisma.auditLog.create({
    data: {
      acao: motivo,
      entidade: 'auth',
      dados: {
        email,
        supabaseUserId,
        timestamp: new Date().toISOString(),
      },
      ip: null, // IP virá do interceptor se disponível
    }
  });
}
```

### 2.3 — AuthController

```typescript
@Post('validate-google')
@HttpCode(HttpStatus.OK)
async validateGoogle(@Body() dto: ValidateGoogleDto) {
  // Este endpoint NÃO usa JwtAuthGuard — é chamado antes da sessão existir
  // A segurança vem da validação interna do service
  return this.authService.validateGoogleOAuth(dto.email, dto.supabaseUserId);
}
```

ATENÇÃO: este endpoint não deve ter JwtAuthGuard porque é chamado no
momento em que a sessão ainda está sendo estabelecida. A proteção
contra abuso é feita pelo rate limiter global (5 req/min por IP via
@nestjs/throttler já configurado na aplicação).

═══════════════════════════════════════════════════════════════════
PARTE 3 — FRONTEND: CALLBACK ROUTE (Next.js)
═══════════════════════════════════════════════════════════════════

Refatore src/app/auth/callback/route.ts para chamar a validação
do backend imediatamente após receber o código do Google.

```typescript
// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const origem = searchParams.get('state') || 'dashboard';
  // `state` pode carregar de onde veio: 'dashboard' ou 'portal'

  // Sem código — erro no fluxo OAuth
  if (!code) {
    return NextResponse.redirect(
      new URL('/login?erro=oauth_falhou', request.url)
    );
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (n) => cookieStore.get(n)?.value,
                  set: (n, v, o) => cookieStore.set(n, v, o),
                  remove: (n, o) => cookieStore.delete({ name: n, ...o }) } }
  );

  // 1. Trocar o code do Google pela sessão Supabase
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session) {
    return NextResponse.redirect(
      new URL('/login?erro=oauth_falhou', request.url)
    );
  }

  const { user, access_token } = data.session;

  // 2. Validar no backend ANTES de qualquer redirecionamento
  //    Se o email não estiver cadastrado, o backend deleta a conta
  //    do Supabase e retorna 403
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/validate-google`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          supabaseUserId: user.id,
        }),
      }
    );

    if (!res.ok) {
      // Backend negou — sessão inválida, limpar cookie
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL('/login?erro=conta_nao_cadastrada', request.url)
      );
    }

    const { tipo } = await res.json();

    // 3. Redirecionar para o destino correto conforme tipo de usuário
    const destino = tipo === 'cliente' ? '/portal' : '/dashboard';
    return NextResponse.redirect(new URL(destino, request.url));

  } catch {
    // Falha de rede ao chamar o backend — negar por precaução
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL('/login?erro=erro_validacao', request.url)
    );
  }
}
```

═══════════════════════════════════════════════════════════════════
PARTE 4 — FRONTEND: TELA DE LOGIN
═══════════════════════════════════════════════════════════════════

Refatore src/app/(auth)/login/page.tsx para:

### 4.1 — Botão Google com comportamento correto

```typescript
async function handleGoogleLogin() {
  setLoadingGoogle(true);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // Não usar queryTypes: 'pkce' separado — já é o padrão com SSR
    }
  });
  if (error) {
    setErro('Não foi possível conectar com o Google. Tente novamente.');
    setLoadingGoogle(false);
  }
  // Não setar loading false aqui — a página vai redirecionar
}
```

### 4.2 — Exibição de erros de acesso negado

Verificar o parâmetro `erro` na URL e exibir mensagens claras:

```typescript
const searchParams = useSearchParams();
const codigoErro = searchParams.get('erro');

const mensagensErro: Record<string, string> = {
  conta_nao_cadastrada:
    'Esta conta Google não está cadastrada no sistema. ' +
    'Entre em contato com o administrador ou seu consultor.',
  oauth_falhou:
    'Não foi possível autenticar com o Google. Tente novamente.',
  erro_validacao:
    'Erro ao validar sua conta. Tente novamente ou use email e senha.',
};

// No JSX — exibir apenas se houver erro:
{codigoErro && mensagensErro[codigoErro] && (
  <div
    role="alert"
    aria-live="assertive"
    className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950
               dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300"
  >
    <i className="ti ti-alert-triangle mr-2" aria-hidden="true" />
    {mensagensErro[codigoErro]}
  </div>
)}
```

### 4.3 — Separação visual entre métodos de login

O botão "Entrar com Google" deve ter um separador visual claro em relação
ao formulário de email/CPF+senha, com o texto "ou" entre eles, deixando
evidente que são dois caminhos distintos — ambos requerem cadastro prévio.

Abaixo do botão Google, adicionar em texto pequeno e discreto:
"Somente contas previamente cadastradas têm acesso."

═══════════════════════════════════════════════════════════════════
PARTE 5 — REGRAS DE NEGÓCIO COMPLEMENTARES
═══════════════════════════════════════════════════════════════════

### 5.1 — Quem pode cadastrar quem

Implemente ou revise os guards dos endpoints de criação para garantir:

| Ação                          | Quem pode executar        |
|-------------------------------|---------------------------|
| Criar operador (users)        | Somente admin             |
| Ativar portal do cliente      | Admin, financeiro, consultor (só carteira) |
| Cadastrar novo cliente        | Admin, financeiro, consultor              |
| Criar outro admin             | Somente admin             |

Nenhum desses endpoints aceita requisição não autenticada.
Nenhum deles pode ser chamado pelo frontend do portal (/api/portal/*).

### 5.2 — Cliente sem portal ativo não pode logar

No validateGoogleOAuth, a query de clientes já filtra `portalAtivo: true`.
Reforçar o mesmo filtro no fluxo de login por email/CPF:

```typescript
// Em AuthService.loginComEmailOuCpf — se identificador for CPF ou email
// e o resultado for um client:
if (client && !client.portalAtivo) {
  throw new UnauthorizedException(
    'Seu acesso ao portal ainda não foi ativado. ' +
    'Entre em contato com a Lidera Financeira.'
  );
}
```

### 5.3 — Operador inativo não pode logar

```typescript
// Em AuthService.login — antes de qualquer operação Supabase:
if (!user.active) {
  throw new UnauthorizedException('Conta desativada. Contate o administrador.');
}
```

### 5.4 — Auditoria de toda tentativa de acesso negado

Toda rejeição deve gerar um registro em AuditLog com:
- acao: 'ACESSO_NEGADO_GOOGLE_DESCONHECIDO' | 'CONTA_INATIVA' |
        'PORTAL_NAO_ATIVO' | 'GOOGLE_SUPABASE_ID_MISMATCH'
- dados: { email, supabaseUserId, motivo }
- ip: extraído do header X-Forwarded-For via @Ip() decorator

Isso permite que o Admin visualize na tela de Auditoria toda tentativa
de acesso não autorizado, identificando possíveis ataques ou erros de
cadastro.

═══════════════════════════════════════════════════════════════════
PARTE 6 — TESTES MANUAIS PARA VALIDAR A IMPLEMENTAÇÃO
═══════════════════════════════════════════════════════════════════

Após implementar, valide cada cenário manualmente:

TESTE 1 — Desconhecido tentando logar com Google
  1. Use uma conta Google que não existe em users nem clients
  2. Clique em "Entrar com Google"
  3. Autorize no popup do Google
  ESPERADO:
  - Redireciona para /login?erro=conta_nao_cadastrada
  - Mensagem de erro exibida na tela de login
  - No Supabase Dashboard → Authentication → Users: a conta NÃO aparece
  - No AuditLog do SIAFI: registro de ACESSO_NEGADO_GOOGLE_DESCONHECIDO

TESTE 2 — Cliente com portal ativo logando com Google
  1. Cadastre um cliente com email real
  2. Ative o portal dele
  3. Use a conta Google desse email
  ESPERADO:
  - Redireciona para /portal
  - clients.supabase_id preenchido após o primeiro login
  - Acesso normal ao portal

TESTE 3 — Operador logando com Google
  1. Crie um operador com email real em users.email
  2. Use a conta Google desse email
  ESPERADO:
  - Redireciona para /dashboard
  - users.supabase_id preenchido após o primeiro login
  - Acesso conforme a role do operador

TESTE 4 — Cliente com portal INATIVO tentando logar com Google
  1. Cadastre um cliente mas NÃO ative o portal
  2. Use a conta Google do email desse cliente
  ESPERADO:
  - Redireciona para /login?erro=conta_nao_cadastrada
  - Conta deletada do Supabase
  - AuditLog registrado

TESTE 5 — Mesma conta Google tentando múltiplos logins
  1. Logue com sucesso (Teste 2 ou 3)
  2. Saia do sistema
  3. Logue novamente
  ESPERADO:
  - Segundo login funciona normalmente
  - supabase_id já estava vinculado — não tenta vincular de novo

═══════════════════════════════════════════════════════════════════
ENTREGÁVEIS
═══════════════════════════════════════════════════════════════════

Implemente nesta ordem:

1. Configuração no painel Supabase (instruir o desenvolvedor):
   - Desativar "Allow new users to sign up"
   - Confirmar que Google OAuth está habilitado em Providers

2. Backend:
   - ValidateGoogleDto
   - AuthService.validateGoogleOAuth() com revogarEAuditar()
   - AuthService: filtro portalAtivo no login por CPF/email de cliente
   - AuthService: filtro active no login de operador
   - AuthController: POST /auth/validate-google (sem JwtAuthGuard)

3. Frontend:
   - src/app/auth/callback/route.ts refatorado
   - Tela de login: handleGoogleLogin() + mensagens de erro por código
   - Texto discreto "Somente contas previamente cadastradas têm acesso"

4. Auditoria:
   - Confirmar que AuditLog registra todos os cenários de rejeição
   - Testar no painel de Auditoria do SIAFI que os logs aparecem

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════════

- deleteUser no Supabase ANTES de lançar ForbiddenException — nunca
  depois. Se lançar antes de deletar, a conta fica órfã no Supabase.

- O endpoint POST /auth/validate-google não tem JwtAuthGuard mas está
  coberto pelo ThrottleGuard global (5 req/min por IP).

- Nunca retornar ao frontend se o email existe ou não no banco —
  mensagem genérica "conta não cadastrada" para todos os casos de
  rejeição (previne enumeração de usuários).

- app_metadata (não user_metadata) para role, prismaId e clientId
  ao vincular o supabaseId pela primeira vez.

- O callback route deve usar try/catch em toda chamada ao backend —
  qualquer exceção de rede deve negar o acesso por precaução, nunca
  liberar.

- Rate limit no endpoint /auth/validate-google: já coberto pelo
  ThrottleGuard global. Não criar rate limit separado.
```
