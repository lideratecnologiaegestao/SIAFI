# SIAFI 2.0 — Fase 2: Portal do Cliente
# Ativação, Gestão e Experiência Completa
# Versão revisada — Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md
e o resultado da Fase 1 já implementada.

---

```
Você é um Engenheiro de Software Sênior e Especialista em UX para sistemas
financeiros. A Fase 1 do SIAFI já está implementada (autenticação, roles,
Supabase Auth, módulo do consultor). Agora implemente a Fase 2 completa:
ativação do portal do cliente e toda a experiência do cliente no portal.

═══════════════════════════════════════════════════════════════════
CONTEXTO DA FASE 2
═══════════════════════════════════════════════════════════════════

O Portal do Cliente é uma área exclusiva acessada em /portal/* com layout
completamente separado do painel administrativo. O cliente visualiza seus
contratos, parcelas, realiza pagamentos via PIX, abre suporte e gerencia
sua segurança.

Mudança em relação à versão anterior: o CONSULTOR agora também pode
ativar o portal dos clientes da sua própria carteira, não apenas
admin e financeiro.

═══════════════════════════════════════════════════════════════════
PARTE 1 — ATIVAÇÃO DO PORTAL (BACKEND)
═══════════════════════════════════════════════════════════════════

## 1.1 — Regras de negócio

| Ação              | Quem pode executar                        |
|-------------------|-------------------------------------------|
| Ativar portal     | admin, financeiro, consultor (só carteira)|
| Desativar portal  | admin, financeiro                         |
| Reativar portal   | admin, financeiro                         |
| Reenviar senha    | admin, financeiro, consultor (só carteira)|
| Ver status portal | admin, financeiro, consultor (só carteira)|

Regras adicionais:
- Cliente precisa ter `email` cadastrado — obrigatório para Supabase Auth
- Se não tiver email: retornar erro 400 com mensagem acionável
- Consultor só pode ativar clientes de sua própria carteira
  (validar `client.consultorId === user.id`)
- Ao ativar: criar conta no Supabase Auth + vincular `supabaseId`
  na tabela `clients` + setar `portalAtivo = true`
- Ao desativar: banir no Supabase (`banned: true`) + `portalAtivo = false`
  NUNCA deletar a conta Supabase (preservar histórico de acesso)
- Reativar: remover ban + `portalAtivo = true`
- Toda operação registrada no `AuditLog` com userId do operador
- Cliente recebe WhatsApp + email ao ter portal ativado

## 1.2 — Endpoints

```
POST  /api/clients/:id/portal/ativar      → ativa (admin/financeiro/consultor)
POST  /api/clients/:id/portal/desativar   → desativa (admin/financeiro)
POST  /api/clients/:id/portal/reativar    → reativa (admin/financeiro)
POST  /api/clients/:id/portal/reenviar-senha → nova senha temporária
GET   /api/clients/:id/portal/status      → status atual + último acesso
```

## 1.3 — PortalService completo

```typescript
@Injectable()
export class PortalService {

  async ativarPortal(clientId: number, operador: User) {
    // 1. Buscar cliente — validar existência e active: true
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, active: true }
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    // 2. Validação de carteira para consultor
    if (operador.role === 'consultor' && client.consultorId !== operador.id) {
      throw new ForbiddenException('Cliente não pertence à sua carteira.');
    }

    // 3. Email obrigatório
    if (!client.email) {
      throw new BadRequestException(
        'Cliente não possui email cadastrado. ' +
        'Atualize o cadastro antes de ativar o portal.'
      );
    }

    // 4. Idempotência — já está ativo?
    if (client.portalAtivo && client.supabaseId) {
      return { sucesso: true, mensagem: 'Portal já estava ativo.', jaAtivo: true };
    }

    // 5. Gerar senha temporária segura
    const senhaTemporaria = this.gerarSenhaTemporaria();

    // 6. Atomicidade: Supabase Auth + Prisma com rollback manual
    let supabaseUserId: string | null = null;
    try {
      // 6a. Criar no Supabase Auth
      // SupabaseService é @Global() — injetar via constructor(private readonly supabase: SupabaseService)
      // Bucket de documentos: 'client-documents' (privado)
      const { data, error } = await this.supabaseAdmin.auth.admin.createUser({
        email: client.email,
        password: senhaTemporaria,
        email_confirm: true,
        app_metadata: {
          role: 'cliente',
          clientId: client.id,
          nome: client.nome,
        }
      });
      if (error) throw new InternalServerErrorException(error.message);
      supabaseUserId = data.user.id;

      // 6b. Atualizar Prisma
      await this.prisma.client.update({
        where: { id: clientId },
        data: {
          supabaseId: supabaseUserId,
          portalAtivo: true,
          portalAtivadoEm: new Date(),
          portalAtivadoPor: operador.id,
          senhaTemporaria: true,
          primeiroAcesso: true,
        }
      });
    } catch (err) {
      // Rollback: remover do Supabase se Prisma falhou
      if (supabaseUserId) {
        await this.supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
      }
      throw err;
    }

    // 7. Registrar no AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId: operador.id,
        acao: 'PORTAL_ATIVADO',
        entidade: 'clients',
        entidadeId: clientId,
        dados: { email: client.email, ativadoPor: operador.nome },
        ip: null,
      }
    });

    // 8. Enfileirar notificações (BullMQ — não bloquear resposta)
    // @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS) private readonly notificationsQueue: Queue
    await this.notificationsQueue.add('whatsapp.portal-ativado', {
      clientId: client.id,
      clienteNome: client.nome,
      clienteWhatsapp: client.whatsapp,
      clienteEmail: client.email,
      senhaTemporaria,
    });
    await this.notificationsQueue.add('email.portal-ativado', {
      clientId: client.id,
      clienteNome: client.nome,
      clienteEmail: client.email,
      senhaTemporaria,
    });

    // 9. Retornar (senha temporária exibida UMA vez para o operador)
    return {
      sucesso: true,
      senhaTemporaria,
      mensagem: `Portal ativado. Senha enviada via WhatsApp e email para ${client.email}.`
    };
  }

  async desativarPortal(clientId: number, operador: User, motivo: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, portalAtivo: true }
    });
    if (!client) throw new NotFoundException('Portal não está ativo.');

    // Banir no Supabase (não deletar)
    await this.supabaseAdmin.auth.admin.updateUser(
      client.supabaseId,
      { ban_duration: 'none' } // ban permanente até reativação
    );

    await this.prisma.client.update({
      where: { id: clientId },
      data: { portalAtivo: false }
    });

    await this.prisma.auditLog.create({
      data: {
        userId: operador.id,
        acao: 'PORTAL_DESATIVADO',
        entidade: 'clients',
        entidadeId: clientId,
        dados: { motivo },
      }
    });

    return { sucesso: true };
  }

  async reenviarSenha(clientId: number, operador: User) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, portalAtivo: true, active: true }
    });
    if (!client) throw new NotFoundException('Portal não está ativo.');

    // Consultor valida carteira
    if (operador.role === 'consultor' && client.consultorId !== operador.id) {
      throw new ForbiddenException('Cliente não pertence à sua carteira.');
    }

    const novaSenha = this.gerarSenhaTemporaria();

    // Atualizar senha no Supabase
    await this.supabaseAdmin.auth.admin.updateUser(
      client.supabaseId,
      { password: novaSenha }
    );

    await this.prisma.client.update({
      where: { id: clientId },
      data: { senhaTemporaria: true, primeiroAcesso: true }
    });

    // Enfileirar notificação
    // @InjectQueue(QUEUE_FINANCE_NOTIFICATIONS) private readonly notificationsQueue: Queue
    await this.notificationsQueue.add('whatsapp.portal-ativado', {
      clientId: client.id,
      clienteNome: client.nome,
      clienteWhatsapp: client.whatsapp,
      senhaTemporaria: novaSenha,
      isReenvio: true,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: operador.id,
        acao: 'PORTAL_SENHA_REENVIADA',
        entidade: 'clients',
        entidadeId: clientId,
      }
    });

    return { sucesso: true, mensagem: 'Nova senha enviada ao cliente.' };
  }

  private gerarSenhaTemporaria(): string {
    // crypto.randomBytes — nunca Math.random()
    // Formato: Aa0!Aa0!Aa0! — garante maiúscula, minúscula, número e especial
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const special = '!@#$%&*';
    const all = upper + lower + digits + special;
    const bytes = require('crypto').randomBytes(12);
    let senha = '';
    // Garantir pelo menos 1 de cada categoria
    senha += upper[bytes[0] % upper.length];
    senha += lower[bytes[1] % lower.length];
    senha += digits[bytes[2] % digits.length];
    senha += special[bytes[3] % special.length];
    for (let i = 4; i < 12; i++) {
      senha += all[bytes[i] % all.length];
    }
    // Embaralhar
    return senha.split('').sort(() => 0.5 - Math.random()).join('');
  }
}
```

═══════════════════════════════════════════════════════════════════
PARTE 2 — CARD "ACESSO AO PORTAL" NO DETALHE DO CLIENTE
═══════════════════════════════════════════════════════════════════

## 2.1 — Localização
Adicione o card na página `/clientes/[id]/page.tsx` e também na
página `/consultor/minha-carteira/[clientId]/page.tsx`.

## 2.2 — Quatro estados visuais obrigatórios

### Estado 1 — Sem email cadastrado
```
┌──────────────────────────────────────────────────────┐
│ 🔒 Portal do Cliente                                 │
├──────────────────────────────────────────────────────┤
│  ⚠️ Sem email cadastrado                             │
│  Adicione um email ao cadastro para poder ativar     │
│  o acesso ao portal.                                 │
│                                                      │
│  [ Editar cadastro ]                                 │
└──────────────────────────────────────────────────────┘
```

### Estado 2 — Inativo (tem email, nunca ativou)
```
┌──────────────────────────────────────────────────────┐
│ 🔒 Portal do Cliente              [ Inativo ]        │
├──────────────────────────────────────────────────────┤
│  📧 joao@email.com                                   │
│  📱 (65) 99999-9999                                  │
│  🪪 123.456.789-00                                   │
│                                                      │
│  O cliente ainda não possui acesso ao portal.        │
│                                                      │
│  [ ✅ Ativar acesso ao portal ]                      │
└──────────────────────────────────────────────────────┘
```

### Estado 3 — Ativo
```
┌──────────────────────────────────────────────────────┐
│ 🔓 Portal do Cliente              [ ✅ Ativo ]       │
├──────────────────────────────────────────────────────┤
│  📧 joao@email.com                                   │
│  Ativado em: 19/05/2026 por João Consultor           │
│  Último acesso: 20/05/2026 às 14:30                  │
│  MFA: ⚠️ Não configurado (3 de 5 logins usados)     │
│                                                      │
│  [ 🔑 Reenviar senha ]    [ ❌ Desativar ]           │
└──────────────────────────────────────────────────────┘
```
Nota: botão "Desativar" visível apenas para admin e financeiro.
O consultor vê apenas "Reenviar senha" em clientes da sua carteira.

### Estado 4 — Desativado (já teve acesso antes)
```
┌──────────────────────────────────────────────────────┐
│ 🔒 Portal do Cliente          [ Desativado ]         │
├──────────────────────────────────────────────────────┤
│  Desativado em: 18/05/2026 por Admin                 │
│                                                      │
│  [ ✅ Reativar acesso ]   (apenas admin/financeiro)  │
└──────────────────────────────────────────────────────┘
```

## 2.3 — Modais de confirmação

### Modal de ativação
```
┌──────────────────────────────────────────────────────┐
│  Ativar Portal do Cliente                            │
├──────────────────────────────────────────────────────┤
│  Você está prestes a criar acesso para:              │
│                                                      │
│  👤 João da Silva                                    │
│  📧 joao@email.com                                   │
│  📱 (65) 99999-9999                                  │
│                                                      │
│  O cliente receberá:                                 │
│  ✉️  Email com senha temporária                      │
│  📱 WhatsApp com instruções de acesso                │
│                                                      │
│  [ Cancelar ]       [ ✅ Confirmar ativação ]        │
└──────────────────────────────────────────────────────┘
```

### Modal de desativação (campo motivo obrigatório)
```
┌──────────────────────────────────────────────────────┐
│  ⚠️ Desativar acesso ao portal                       │
├──────────────────────────────────────────────────────┤
│  João da Silva perderá o acesso imediatamente.       │
│  Histórico e dados serão mantidos.                   │
│                                                      │
│  Motivo (obrigatório):                               │
│  [ __________________________________ ]              │
│                                                      │
│  [ Cancelar ]    [ ❌ Confirmar desativação ]        │
└──────────────────────────────────────────────────────┘
```

## 2.4 — Indicador na listagem de clientes

Adicione coluna "Portal" na tabela `/clientes` e `/consultor/minha-carteira`:
- 🟢 Ativo
- 🔴 Inativo
- ⚫ Sem email

Filtro adicional na busca: "Portal: Todos / Ativo / Inativo / Sem acesso"

═══════════════════════════════════════════════════════════════════
PARTE 3 — SCHEMA PRISMA (CAMPOS DO PORTAL)
═══════════════════════════════════════════════════════════════════

Confirme que o model `Client` possui todos estes campos
(adicionar os que ainda não existirem):

```prisma
model Client {
  // ... campos existentes da Fase 1 ...

  supabaseId          String?   @unique @map("supabase_id")
  portalAtivo         Boolean   @default(false) @map("portal_ativo")
  portalAtivadoEm     DateTime? @map("portal_ativado_em")
  portalAtivadoPor    Int?      @map("portal_ativado_por")
  senhaTemporaria     Boolean   @default(false) @map("senha_temporaria")
  primeiroAcesso      Boolean   @default(true)  @map("primeiro_acesso")
  ultimoAcessoPortal  DateTime? @map("ultimo_acesso_portal")
  mfaEnabled          Boolean   @default(false) @map("mfa_enabled")
  mfaLoginCount       Int       @default(0)     @map("mfa_login_count")
  mfaDecidedAt        DateTime? @map("mfa_decided_at")
  consultorId         Int?      @map("consultor_id")
  consultor           User?     @relation("ClienteConsultor", fields: [consultorId], references: [id])
}
```

═══════════════════════════════════════════════════════════════════
PARTE 4 — PORTAL DO CLIENTE (FRONTEND — ROTAS ISOLADAS)
═══════════════════════════════════════════════════════════════════

## 4.1 — Estrutura de rotas

```
src/app/
├── (auth)/
│   ├── login/page.tsx
│   └── portal/
│       ├── primeiro-acesso/page.tsx   ← troca de senha obrigatória
│       ├── mfa-setup/page.tsx
│       └── mfa-challenge/page.tsx
└── (portal)/                          ← grupo de layout SEPARADO
    ├── layout.tsx                     ← header simples + footer
    └── portal/
        ├── page.tsx                   ← home (resumo financeiro)
        ├── contratos/
        │   ├── page.tsx               ← lista com barra de progresso
        │   └── [id]/page.tsx          ← detalhe + parcelas
        ├── pagamentos/
        │   ├── page.tsx               ← histórico agrupado por mês
        │   └── pix/[installmentId]/page.tsx ← QR Code + polling
        ├── suporte/
        │   ├── page.tsx               ← lista de tickets
        │   └── novo/page.tsx
        └── perfil/page.tsx            ← dados + segurança + notificações
```

## 4.2 — Layout do portal (`(portal)/layout.tsx`)
- Header: logo Lidera + "Olá, [nome]" + botão Sair
- SEM sidebar administrativa
- Footer: "Lidera Financeira © 2026 | Suporte: (65) 99999-9999"
- Mobile first — cliente acessa principalmente pelo celular
- Badge de notificações no header (parcelas próximas + tickets respondidos)
- Via Supabase Realtime:
```typescript
supabase
  .channel(`portal-${clientId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'support_tickets',
    filter: `client_id=eq.${clientId}`
  }, handleTicketUpdate)
  .subscribe()
```

## 4.3 — Middleware de segurança

Crie `src/middleware.ts` para interceptar todas as rotas /portal/*:
```typescript
export async function middleware(request: NextRequest) {
  const { data: { session } } = await supabase.auth.getSession();

  // Sem sessão → redirecionar para login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Primeiro acesso → forçar troca de senha
  const isPrimeiroAcesso = session.user.user_metadata?.primeiroAcesso;
  const isRotaPrimeiroAcesso = request.nextUrl.pathname === '/portal/primeiro-acesso';
  if (isPrimeiroAcesso && !isRotaPrimeiroAcesso) {
    return NextResponse.redirect(new URL('/portal/primeiro-acesso', request.url));
  }

  // MFA pendente/obrigatório
  const mfaStatus = session.user.user_metadata?.mfaStatus;
  if (mfaStatus === 'obrigatorio') {
    return NextResponse.redirect(new URL('/auth/portal/mfa-setup', request.url));
  }

  return NextResponse.next();
}
export const config = { matcher: ['/portal/:path*'] };
```

## 4.4 — Tela de primeiro acesso (`/auth/portal/primeiro-acesso`)

Exibida obrigatoriamente após o primeiro login com senha temporária:
```
┌──────────────────────────────────────────────────────┐
│  Bem-vindo ao Portal Lidera! 🎉                      │
│                                                      │
│  Por segurança, defina sua senha pessoal:            │
│                                                      │
│  Nova senha:    [ __________________ ] 👁            │
│  Confirmar:     [ __________________ ] 👁            │
│                                                      │
│  Requisitos:                                         │
│  ✅ Mínimo 8 caracteres                              │
│  ✅ Uma letra maiúscula                              │
│  ✅ Um número                                        │
│  ✅ Um caractere especial (!@#$%&*)                  │
│                                                      │
│  [ Salvar minha senha e continuar ]                  │
└──────────────────────────────────────────────────────┘
```

Após salvar:
1. Chamar `supabase.auth.updateUser({ password: novaSenha })`
2. Chamar `PATCH /api/portal/perfil/primeiro-acesso` → setar
   `primeiroAcesso = false`, `senhaTemporaria = false` no Prisma
3. Exibir modal de MFA (início da contagem de 5 logins)
4. Redirecionar para `/portal`

## 4.5 — Home do portal (`/portal/page.tsx`)

### Cards de resumo (linha 1)
```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Contratos      │ │ Próx. parcela  │ │ Total em aberto│
│ ativos: 2      │ │ R$ 280,00      │ │ R$ 1.400,00    │
│                │ │ vence 25/05    │ │                │
└────────────────┘ └────────────────┘ └────────────────┘
```

### Banners de alerta (condicional — mostrar apenas o mais urgente)
```
// Prioridade 1 — parcela vencida
┌──────────────────────────────────────────────────────┐
│ 🔴 Você possui parcela(s) em atraso                  │
│ Contrato #2 · Parcela 3/5 · Vencida há 5 dias       │
│ [ Regularizar agora ]                                │
└──────────────────────────────────────────────────────┘

// Prioridade 2 — parcela vencendo em até 3 dias
┌──────────────────────────────────────────────────────┐
│ 🟡 Parcela vence em 2 dias                           │
│ Contrato #2 · R$ 280,00 · Vence 22/05/2026          │
│ [ Pagar com PIX agora ]                              │
└──────────────────────────────────────────────────────┘

// Prioridade 3 — MFA pendente
┌──────────────────────────────────────────────────────┐
│ ⚠️ Proteja sua conta                                 │
│ Configure o Google Authenticator. Você tem           │
│ 2 acesso(s) antes de ser obrigatório.                │
│ [ Configurar agora ]           [ Depois ]            │
└──────────────────────────────────────────────────────┘

// Sem pendências
┌──────────────────────────────────────────────────────┐
│ 🟢 Tudo certo! Você está em dia com seus pagamentos. │
└──────────────────────────────────────────────────────┘
```

### Últimas movimentações (últimos 5 pagamentos)
```
┌──────────────────────────────────────────────────────┐
│  Últimas movimentações                               │
│  ──────────────────────────────────────────────────  │
│  ✅ Parcela 2/5 · Contrato #2 · R$ 280,00 · 10/05   │
│  ✅ Parcela 1/5 · Contrato #2 · R$ 280,00 · 10/04   │
│  ✅ Parcela 5/5 · Contrato #1 · R$ 200,00 · 05/04   │
│                             [ Ver histórico ]        │
└──────────────────────────────────────────────────────┘
```

## 4.6 — Contratos (`/portal/contratos`)

### Lista com barra de progresso
```
┌──────────────────────────────────────────────────────┐
│  Meus Contratos                                      │
├──────────────────────────────────────────────────────┤
│  Contrato #1                       [ ✅ Quitado ]    │
│  R$ 1.000,00 · 5 parcelas · Jan 2026                │
│  ████████████████████ 100%                          │
│                              [ Ver detalhes ]        │
├──────────────────────────────────────────────────────┤
│  Contrato #2                        [ 🔵 Ativo ]     │
│  R$ 1.400,00 · 5 parcelas · Mar 2026                │
│  ████████░░░░░░░░░░░░ 40%                           │
│  Próxima: R$ 280,00 · 25/05/2026                    │
│                              [ Ver detalhes ]        │
└──────────────────────────────────────────────────────┘
```

### Detalhe do contrato (`/portal/contratos/[id]`)
```
┌──────────────────────────────────────────────────────┐
│  ← Voltar    Contrato #2                             │
├──────────────────────────────────────────────────────┤
│  Valor emprestado:   R$ 1.000,00                     │
│  Total a pagar:      R$ 1.400,00                     │
│  Total pago:         R$   560,00                     │
│  Saldo restante:     R$   840,00                     │
│  Início:             01/03/2026                      │
│  Pagamento:          PIX                             │
├──────────────────────────────────────────────────────┤
│  Parcelas                                            │
│  ──────────────────────────────────────────────────  │
│  1/5  R$280,00  01/04/26  ✅ Pago em 10/04/26        │
│  2/5  R$280,00  01/05/26  ✅ Pago em 10/05/26        │
│  3/5  R$280,00  01/06/26  🔵 Pendente               │
│                           [ Pagar com PIX ]          │
│  4/5  R$280,00  01/07/26  ⏳ Aguardando             │
│  5/5  R$280,00  01/08/26  ⏳ Aguardando             │
└──────────────────────────────────────────────────────┘
```

Campos que NUNCA devem aparecer para o cliente:
- `valorInvestido` (custo interno de capital)
- `taxaJuros` (taxa interna)
- `observacoes` internas
- `consultorId` ou nome do consultor responsável

## 4.7 — Pagamento PIX (`/portal/pagamentos/pix/[installmentId]`)

### Fluxo completo
```
┌──────────────────────────────────────────────────────┐
│  ← Voltar    Pagar com PIX                           │
├──────────────────────────────────────────────────────┤
│  Contrato #2 · Parcela 3/5                           │
│  Vencimento: 01/06/2026                              │
│                                                      │
│  Valor: R$ 280,00                                    │
│                                                      │
│  ┌──────────────────────────┐                        │
│  │    [QR CODE 200×200px]   │                        │
│  └──────────────────────────┘                        │
│                                                      │
│  Copia e Cola:                                       │
│  [ 00020126580014br... ]   [ 📋 Copiar ]             │
│                                                      │
│  ⏱️ Válido por 30 minutos                            │
│  [ 🔄 Gerar novo QR Code ]                           │
│                                                      │
│  ✅ Confirmação automática em até 5 minutos.         │
│  [ 📤 Compartilhar código ]  ← Web Share API mobile  │
└──────────────────────────────────────────────────────┘
```

### Comportamento técnico
- Ao carregar: verificar se existe `PixPayment` não expirado para esta
  parcela → reusar. Se não: gerar automaticamente via
  `POST /api/portal/pix/gerar`
- Polling a cada 10s em `GET /api/portal/pix/status/[pixId]`
- Cleanup obrigatório no `useEffect` para parar polling ao desmontar
- Ao receber status `approved`:
  1. Parar polling
  2. Exibir tela de sucesso com animação
  3. Redirecionar para `/portal/contratos/[id]` após 3s

### Tela de sucesso
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│           ✅  Pagamento confirmado!                  │
│                                                      │
│   Parcela 3/5 do Contrato #2                        │
│   R$ 280,00 · pago em 20/05/2026                    │
│                                                      │
│   Redirecionando em 3s...                            │
│                                                      │
│   [ Ver meus contratos ]                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

## 4.8 — Histórico de pagamentos (`/portal/pagamentos`)
```
┌──────────────────────────────────────────────────────┐
│  Histórico de Pagamentos                             │
│  Filtrar: [ Todos os contratos ▼ ]  [ Mês ▼ ]       │
├──────────────────────────────────────────────────────┤
│  Maio 2026                                           │
│  10/05  Parcela 2/5 · Contrato #2  R$280,00  PIX    │
├──────────────────────────────────────────────────────┤
│  Abril 2026                                          │
│  10/04  Parcela 1/5 · Contrato #2  R$280,00  PIX    │
│  05/04  Parcela 5/5 · Contrato #1  R$200,00  PIX    │
└──────────────────────────────────────────────────────┘
```

## 4.9 — Suporte (`/portal/suporte`)

### Lista de tickets
```
┌──────────────────────────────────────────────────────┐
│  Suporte                        [ + Novo chamado ]   │
├──────────────────────────────────────────────────────┤
│  #003  Dúvida sobre parcela      🟡 Aguardando       │
│        Aberto em 18/05/2026                          │
├──────────────────────────────────────────────────────┤
│  #002  Erro no QR Code PIX       ✅ Respondido       │
│        Aberto em 10/05/2026  [ Ver resposta ]        │
└──────────────────────────────────────────────────────┘
```

### Novo ticket (`/portal/suporte/novo`)
Assuntos disponíveis (select):
- Dúvida sobre parcela
- Problema com pagamento PIX
- Solicitação de renegociação
- Atualização de dados cadastrais
- Outro

Campos: Assunto (select) + Contrato relacionado (opcional) + Mensagem

## 4.10 — Perfil e segurança (`/portal/perfil`)
```
┌──────────────────────────────────────────────────────┐
│  Meu Perfil                                          │
├──────────────────────────────────────────────────────┤
│  👤 João da Silva                                    │
│  📧 joao@email.com                                   │
│  📱 (65) 99999-9999                                  │
│  🪪 123.456.789-00                                   │
│  ⚠️ Para alterar seus dados, contate a Lidera.       │
├──────────────────────────────────────────────────────┤
│  Segurança                                           │
│  ─────────────────────────────────────────────────   │
│  Senha             [ Alterar senha ]                 │
│                                                      │
│  Google Authenticator                                │
│  [ ⚠️ Não configurado — Configurar agora ]           │
│  ou [ ✅ Ativo — Remover ]                           │
├──────────────────────────────────────────────────────┤
│  Notificações                                        │
│  ─────────────────────────────────────────────────   │
│  WhatsApp   🔔 Ativado   [ toggle ]                  │
│  Email      🔔 Ativado   [ toggle ]                  │
└──────────────────────────────────────────────────────┘
```

═══════════════════════════════════════════════════════════════════
PARTE 5 — BACKEND: ENDPOINTS DO PORTAL
═══════════════════════════════════════════════════════════════════

Todos em `/api/portal/*` — exigem `ClientPortalGuard` (role = cliente).
Toda query filtra por `clientId` extraído do JWT. Sem exceção.

```
GET   /api/portal/home
      → { contratosAtivos, proximaParcela, totalEmAberto,
          ultimosPagamentos[5], alertas[] }

GET   /api/portal/contratos
      → lista contratos (sem valorInvestido, taxaJuros, observacoes)

GET   /api/portal/contratos/:id
      → detalhe + parcelas (validar ownership obrigatório)

GET   /api/portal/pagamentos
      → histórico paginado com filtro por contrato e mês

POST  /api/portal/pix/gerar
      → { installmentId } → gera ou reutiliza QR Code

GET   /api/portal/pix/status/:pixId
      → { status, paidAt? } — usado no polling

GET   /api/portal/suporte
      → tickets do cliente

POST  /api/portal/suporte
      → novo ticket

GET   /api/portal/suporte/:id
      → detalhe do ticket

GET   /api/portal/perfil
      → dados públicos (sem taxaJuros, valorInvestido, consultorId)

PATCH /api/portal/perfil/primeiro-acesso
      → setar primeiroAcesso=false, senhaTemporaria=false

PATCH /api/portal/notificacoes
      → { notificacoesEmail, notificacoesWhatsapp }
```

### ClientPortalGuard — validação de ownership

```typescript
@Injectable()
export class ClientPortalGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const supabaseToken = request.headers.authorization?.split(' ')[1];

    // 1. Validar JWT com Supabase
    // Validar JWT Supabase com SUPABASE_JWT_SECRET (mesmo segredo do JwtAuthGuard)
    const { data: { user }, error } = await supabase.auth.getUser(supabaseToken);
    if (error || !user) throw new UnauthorizedException();

    // 2. Buscar na tabela clients
    const client = await prisma.client.findFirst({
      where: { supabaseId: user.id, active: true, portalAtivo: true }
    });
    if (!client) throw new ForbiddenException('Acesso ao portal não autorizado.');

    // 3. Atualizar último acesso (sem aguardar — fire and forget)
    prisma.client.update({
      where: { id: client.id },
      data: { ultimoAcessoPortal: new Date() }
    }).catch(() => {});

    // 4. Injetar no request
    request.user = { ...client, role: 'cliente', tipo: 'cliente' };
    return true;
  }
}
```

### Validação de ownership em todo endpoint

```typescript
// Padrão obrigatório em todo método que recebe :id
async getContrato(loanId: number, clientId: number) {
  const loan = await this.prisma.loan.findFirst({
    where: { id: loanId, clientId } // clientId do JWT — nunca só o loanId
  });
  if (!loan) throw new ForbiddenException('Acesso negado.');
  return loan;
}
```

═══════════════════════════════════════════════════════════════════
PARTE 6 — MENSAGENS DE NOTIFICAÇÃO
═══════════════════════════════════════════════════════════════════

## 6.1 — WhatsApp (template de ativação)
```
Olá, {nome}! 👋

Seu acesso ao portal da *Lidera Financeira* foi ativado.

🔐 *Seus dados de acesso:*
• Usuário: {cpf_formatado} ou {email}
• Senha temporária: {senha_temporaria}

🌐 *Acesso:* https://financeiro.lidera.app.br/portal

⚠️ Troque sua senha no primeiro acesso.
```

## 6.2 — WhatsApp (reenvio de senha)
```
Olá, {nome}! 🔑

Sua senha do portal foi redefinida.

• Nova senha temporária: {senha_temporaria}
• Acesso: https://financeiro.lidera.app.br/portal

⚠️ Troque sua senha ao fazer login.
```

## 6.3 — Email (template HTML)
- Assunto: "Seu acesso ao Portal Lidera está pronto"
- Conteúdo: logo + dados de acesso + botão CTA + aviso de segurança
- Template implementado no `email.worker.ts` com nodemailer

═══════════════════════════════════════════════════════════════════
PARTE 7 — ENTREGÁVEIS DA FASE 2 (em ordem)
═══════════════════════════════════════════════════════════════════

1.  Migration Prisma com os campos do portal no model `Client`
    (supabaseId, portalAtivo, portalAtivadoEm, portalAtivadoPor,
    senhaTemporaria, primeiroAcesso, ultimoAcessoPortal)

2.  `PortalService` completo:
    - ativarPortal (com validação de carteira para consultor)
    - desativarPortal (com campo motivo)
    - reativarPortal
    - reenviarSenha (com validação de carteira para consultor)
    - gerarSenhaTemporaria (crypto.randomBytes)

3.  `PortalController` com os 5 endpoints de gestão do portal
    (protegidos com roles corretas por endpoint)

4.  Card "Acesso ao Portal" com 4 estados visuais (Next.js + Tailwind
    + shadcn/ui) — para página admin e página do consultor

5.  Modais de confirmação (ativação e desativação com campo motivo)

6.  Coluna "Portal" na listagem de clientes (admin e consultor)

7.  Middleware Next.js para /portal/* (auth + primeiroAcesso + MFA)

8.  `(portal)/layout.tsx` com header, footer e badge Realtime

9.  Tela de primeiro acesso com validação de senha

10. `/portal/page.tsx` — home com cards, banners contextuais
    e últimas movimentações

11. `/portal/contratos` — lista com barra de progresso

12. `/portal/contratos/[id]` — detalhe com tabela de parcelas

13. `/portal/pagamentos/pix/[installmentId]` — QR Code + polling
    + tela de sucesso + Web Share API

14. `/portal/pagamentos` — histórico com filtros

15. `/portal/suporte` — lista + novo ticket

16. `/portal/perfil` — dados + segurança + notificações

17. `ClientPortalGuard` isolado do RolesGuard administrativo

18. `ClientPortalService` com todos os métodos e ownership

19. `ClientPortalController` com todos os endpoints

20. Hook `useRealtimePortal` para badge de notificações

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════════
- $transaction do Prisma em toda operação Supabase Auth + banco
- Se Supabase falhar: NÃO atualizar o banco (rollback)
- Se Prisma falhar: deletar usuário no Supabase (rollback)
- Senha temporária com crypto.randomBytes — NUNCA Math.random()
- Senha temporária NÃO salva no banco — apenas enviada ao cliente
- TODA query do portal filtra por clientId do JWT — sem exceção
- Ownership validado no service, não só na rota
- Polling do PIX com cleanup no useEffect (evitar memory leak)
- NUNCA retornar: valorInvestido, taxaJuros, observacoes, consultorId
- Layout (portal)/* completamente separado do (dashboard)/*
- Registrar no AuditLog: ativação, desativação, reenvio de senha,
  geração de QR Code, acesso ao portal (via ClientPortalGuard)
- Idempotência no PIX: reusar QR Code ativo se já existir
- Consultor só opera clientes onde client.consultorId === user.id
- Botão "Desativar" visível apenas para admin e financeiro
- Mensagens de erro genéricas ao cliente (nunca vazar dados internos)
```
