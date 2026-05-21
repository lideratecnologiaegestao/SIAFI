# SIAFI 2.0 — Fase 3: Portal do Cliente (Experiência Completa)
# Versão revisada — Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md
e os resultados das Fases 1 e 2 já implementadas.

---

```
Você é um Engenheiro de Software Sênior e Especialista em UX/UI para sistemas
financeiros. As Fases 1 e 2 do SIAFI já estão implementadas (auth, roles,
Supabase, ativação do portal). Implemente agora a Fase 3 completa: todas as
telas e a lógica do Portal do Cliente — a experiência que o cliente final vê
ao acessar https://financeiro.lidera.app.br/portal.

═══════════════════════════════════════════════════════════════════
CONTEXTO E PREMISSAS
═══════════════════════════════════════════════════════════════════

- Stack: Next.js 16 (App Router), Tailwind CSS, shadcn/ui, React Query,
  Supabase SSR, Supabase Realtime
- Antes de implementar: verificar se `type UserRole` no AuthContext foi atualizado
  para incluir 'consultor' e remover 'usuario':
  `type UserRole = 'admin' | 'financeiro' | 'consultor' | 'caixa' | 'cliente'`
- O ClientPortalGuard e todos os endpoints /api/portal/* já existem
  (implementados na Fase 2)
- O middleware.ts de /portal/* já existe (Fase 2)
- Foco desta fase: implementar TODAS as páginas e componentes do portal
- Design: mobile first — o cliente acessa pelo celular
- Paleta: mesma do sistema (Slate/dark) mas mais acolhedora, menos técnica
- Acessibilidade: WCAG AA mínimo em todas as telas

═══════════════════════════════════════════════════════════════════
PARTE 1 — ARQUITETURA FRONTEND DO PORTAL
═══════════════════════════════════════════════════════════════════

## 1.1 — Estrutura completa de arquivos

```
src/app/
├── (auth)/
│   └── login/page.tsx                    ← já implementado (Fase 1)
│
├── auth/
│   └── callback/route.ts                 ← já implementado (Fase 1)
│
├── portal/                               ← telas de onboarding (fora do layout)
│   ├── primeiro-acesso/page.tsx          ← troca de senha obrigatória
│   ├── mfa-setup/page.tsx                ← setup Google Authenticator
│   └── mfa-challenge/page.tsx            ← desafio TOTP no login
│
└── (portal)/                             ← grupo com layout do portal
    ├── layout.tsx                        ← header + footer + Realtime
    └── portal/
        ├── page.tsx                      ← home (resumo financeiro)
        ├── contratos/
        │   ├── page.tsx                  ← lista com progresso
        │   └── [id]/
        │       └── page.tsx              ← detalhe + parcelas
        ├── pagamentos/
        │   ├── page.tsx                  ← histórico agrupado por mês
        │   └── pix/
        │       └── [installmentId]/
        │           └── page.tsx          ← QR Code + polling + sucesso
        ├── suporte/
        │   ├── page.tsx                  ← lista de tickets
        │   ├── [id]/page.tsx             ← detalhe do ticket + resposta
        │   └── novo/page.tsx             ← abrir novo chamado
        └── perfil/
            └── page.tsx                  ← dados + segurança + notificações

src/components/portal/
├── portal-layout/
│   ├── portal-header.tsx                 ← logo + nome + badge + sair
│   └── portal-footer.tsx                 ← dados da empresa + links
├── portal-home/
│   ├── resumo-cards.tsx                  ← 3 cards KPI
│   ├── alerta-banner.tsx                 ← banner contextual de alerta
│   └── ultimas-movimentacoes.tsx         ← lista dos últimos pagamentos
├── portal-contratos/
│   ├── contrato-card.tsx                 ← card com barra de progresso
│   └── parcela-row.tsx                   ← linha da tabela de parcelas
├── portal-pix/
│   ├── qr-code-display.tsx               ← imagem + copia e cola + timer
│   └── pix-sucesso.tsx                   ← tela de confirmação animada
├── portal-suporte/
│   ├── ticket-card.tsx                   ← card do ticket na lista
│   └── ticket-detalhe.tsx                ← conversa + resposta
└── portal-perfil/
    ├── dados-pessoais.tsx                ← dados read-only
    ├── seguranca-section.tsx             ← senha + MFA
    └── notificacoes-section.tsx          ← toggles WhatsApp/Email

src/hooks/portal/
├── use-portal-home.ts                    ← React Query para home
├── use-portal-contratos.ts               ← React Query para contratos
├── use-portal-pix.ts                     ← polling do PIX
├── use-portal-suporte.ts                 ← React Query para tickets
└── use-realtime-portal.ts                ← Supabase Realtime

src/lib/portal/
├── portal-api.ts                         ← funções axios para /api/portal/*
└── portal-types.ts                       ← interfaces TypeScript do portal
```

## 1.2 — Interfaces TypeScript (`src/lib/portal/portal-types.ts`)

```typescript
// Dados retornados pelo /api/portal/home
export interface PortalHome {
  contratosAtivos: number
  proximaParcela: {
    installmentId: number
    loanId: number
    loanNumero: number
    numeroParcela: number
    totalParcelas: number
    valor: number
    dataVencimento: string
    diasParaVencer: number
    status: 'pendente' | 'atrasado'
  } | null
  totalEmAberto: number
  ultimosPagamentos: UltimoPagamento[]
  alertas: Alerta[]
}

export interface Alerta {
  tipo: 'vencida' | 'vencendo' | 'em_dia' | 'mfa_pendente'
  mensagem: string
  installmentId?: number
  loanId?: number
  diasAtraso?: number
  loginsRestantesMfa?: number
}

export interface UltimoPagamento {
  id: number
  valorPago: number
  dataPagamento: string
  metodoPagamento: string
  numeroParcela: number
  totalParcelas: number
  loanNumero: number
}

// Contrato simplificado para o portal (sem campos internos)
export interface PortalContrato {
  id: number
  numero: number           // sequencial por cliente (Contrato #1, #2...)
  totalParcelas: number
  parcelasPagas: number
  valorTotal: number       // soma das parcelas (não valorInvestido)
  totalPago: number
  saldoRestante: number
  dataInicio: string
  metodoPagamento: string
  status: 'ativo' | 'quitado' | 'inadimplente' | 'cancelado'
  progressoPercentual: number
  proximaParcela: {
    id: number
    numero: number
    valor: number
    dataVencimento: string
    status: 'pendente' | 'atrasado'
  } | null
  // NUNCA incluir: valorInvestido, taxaJuros, observacoes, consultorId
}

export interface PortalParcela {
  id: number
  numero: number
  valor: number
  dataVencimento: string
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  totalPago: number
  dataPagamento?: string
  metodoPagamento?: string
}

export interface PixStatus {
  pixId: number
  status: 'pendente' | 'aprovado' | 'expirado' | 'cancelado'
  qrCode: string
  qrImage: string
  valor: number
  expiresAt: string
  paidAt?: string
}

export interface SupportTicket {
  id: number
  assunto: string
  mensagem: string
  status: 'aberto' | 'respondido' | 'fechado'
  resposta?: string
  createdAt: string
  updatedAt: string
  lido: boolean
}
```

═══════════════════════════════════════════════════════════════════
PARTE 2 — LAYOUT DO PORTAL
═══════════════════════════════════════════════════════════════════

## 2.1 — `(portal)/layout.tsx`

```typescript
// Responsabilidades:
// 1. Verificar sessão Supabase (client-side) — redirecionar se expirada
// 2. Montar header com nome do cliente e badge de notificações
// 3. Montar footer
// 4. Inicializar hook useRealtimePortal
// 5. Prover QueryClient do React Query para as páginas filhas

export default function PortalLayout({ children }) {
  const { cliente, isLoading } = usePortalCliente()
  const { notificacoes } = useRealtimePortal(cliente?.id)

  if (isLoading) return <PortalSkeleton />

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <PortalHeader cliente={cliente} notificacoes={notificacoes} />
      <main className="flex-1 container max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
      <PortalFooter />
    </div>
  )
}
```

## 2.2 — `portal-header.tsx`

Especificação visual (mobile):
```
┌──────────────────────────────────────────────────┐
│  [LOGO]  Lidera                    🔔2  [Sair]   │
│          Olá, João da Silva                      │
└──────────────────────────────────────────────────┘
```

- Logo: usar `next/image` com `src` da configuração `site_settings`
- Badge 🔔: número de notificações não lidas (tickets respondidos +
  parcelas próximas). Usar `useRealtimePortal` para atualizar em tempo real
- Botão Sair: chamar `supabase.auth.signOut()` + redirecionar para `/login`
- Nome: extrair do JWT (`user_metadata.nome`)
- Sticky no topo: `position: sticky; top: 0; z-index: 50`
- Altura: 60px em mobile, 64px em desktop

## 2.3 — `use-realtime-portal.ts`

```typescript
export function useRealtimePortal(clientId: number | undefined) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const qc = useQueryClient()

  useEffect(() => {
    if (!clientId) return

    const channel = supabase
      .channel(`portal-${clientId}`)
      // Ticket respondido → badge + invalidar cache
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'support_tickets',
        filter: `client_id=eq.${clientId}`,
      }, (payload) => {
        if (payload.new.status === 'respondido') {
          setNotificacoes(prev => [...prev, {
            tipo: 'ticket_respondido',
            ticketId: payload.new.id,
            assunto: payload.new.assunto,
          }])
          qc.invalidateQueries({ queryKey: ['portal', 'suporte'] })
        }
      })
      // Pagamento confirmado → invalidar contratos e home
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'payments',
      }, (payload) => {
        // Filtrar no handler — Supabase Realtime não suporta subqueries em filtros
        // clientLoanIds: Set<number> com os IDs dos loans do cliente
        // Buscar na inicialização: const loans = await portalApi.getContratos()
        // const clientLoanIds = new Set(loans.map(l => l.id))
        if (!clientLoanIds.has(payload.new?.loan_id)) return;
        qc.invalidateQueries({ queryKey: ['portal', 'home'] })
        qc.invalidateQueries({ queryKey: ['portal', 'contratos'] })
      })
      .subscribe()

    // Cleanup obrigatório — evitar memory leak e conexões duplicadas
    return () => { supabase.removeChannel(channel) }
  }, [clientId, qc])

  return { notificacoes, limparNotificacoes: () => setNotificacoes([]) }
}
```

═══════════════════════════════════════════════════════════════════
PARTE 3 — HOME DO PORTAL (`/portal/page.tsx`)
═══════════════════════════════════════════════════════════════════

## 3.1 — Hook `use-portal-home.ts`

```typescript
export function usePortalHome() {
  return useQuery({
    queryKey: ['portal', 'home'],
    queryFn: () => portalApi.getHome(),
    staleTime: 30_000,     // 30s — dados frescos o suficiente
    refetchOnWindowFocus: true,
  })
}
```

## 3.2 — Layout da home (mobile first)

```
┌──────────────────────────────────────────────────┐
│  Olá, João!                         Maio 2026    │
│  Bem-vindo ao seu portal financeiro              │
└──────────────────────────────────────────────────┘

[BANNER DE ALERTA — condicional, máximo 1 visível]

┌────────────┐ ┌────────────┐ ┌────────────┐
│ Contratos  │ │Próx.parcela│ │Em aberto   │
│ ativos     │ │            │ │            │
│     2      │ │ R$ 280,00  │ │R$ 1.400,00 │
│            │ │ em 25/05   │ │            │
└────────────┘ └────────────┘ └────────────┘

┌──────────────────────────────────────────────────┐
│  Últimas movimentações              [Ver tudo →] │
│  ──────────────────────────────────────────────  │
│  ✅ Parc. 2/5 · Contrato #2 · R$280 · 10/05     │
│  ✅ Parc. 1/5 · Contrato #2 · R$280 · 10/04     │
│  ✅ Parc. 5/5 · Contrato #1 · R$200 · 05/04     │
└──────────────────────────────────────────────────┘
```

## 3.3 — Banners de alerta (componente `alerta-banner.tsx`)

Lógica de prioridade — mostrar apenas o banner mais urgente:

```typescript
function resolverAlerta(alertas: Alerta[]): Alerta | null {
  // Prioridade 1: parcela vencida
  const vencida = alertas.find(a => a.tipo === 'vencida')
  if (vencida) return vencida

  // Prioridade 2: parcela vencendo em até 3 dias
  const vencendo = alertas.find(a => a.tipo === 'vencendo')
  if (vencendo) return vencendo

  // Prioridade 3: MFA pendente
  const mfa = alertas.find(a => a.tipo === 'mfa_pendente')
  if (mfa) return mfa

  // Nenhum: mostrar banner "em dia"
  return { tipo: 'em_dia', mensagem: 'Você está em dia com seus pagamentos.' }
}
```

Variantes visuais dos banners:
```
// Vencida (vermelho)
┌──────────────────────────────────────────────────┐
│ ● Parcela em atraso — {X} dias                   │
│ Contrato #{n} · Parcela {p}/{t} · R$ {v}         │
│ [ Regularizar agora → ]                          │
└──────────────────────────────────────────────────┘
border-left: 3px solid var(--color-border-danger)
background: var(--color-background-danger)

// Vencendo (amarelo)
┌──────────────────────────────────────────────────┐
│ ● Parcela vence em {X} dia(s)                    │
│ Contrato #{n} · R$ {v} · Vence {data}            │
│ [ Pagar com PIX agora → ]                        │
└──────────────────────────────────────────────────┘
border-left: 3px solid var(--color-border-warning)
background: var(--color-background-warning)

// MFA pendente (cinza)
┌──────────────────────────────────────────────────┐
│ ⚠ Proteja sua conta                              │
│ Configure o Google Authenticator.                │
│ Você tem {X} acesso(s) antes de ser obrigatório. │
│ [ Configurar agora ]    [ Depois ]               │
└──────────────────────────────────────────────────┘

// Em dia (verde)
┌──────────────────────────────────────────────────┐
│ ✓ Tudo certo! Você está em dia.                  │
└──────────────────────────────────────────────────┘
border-left: 3px solid var(--color-border-success)
background: var(--color-background-success)
```

## 3.4 — Cards KPI (`resumo-cards.tsx`)

Grid responsivo de 3 colunas:
- Contratos ativos: número inteiro, link para `/portal/contratos`
- Próxima parcela: valor formatado (R$) + data relativa ("em 5 dias" /
  "vence hoje" / "atrasada há 3 dias"). Cor condicional por urgência.
  Link direto para PIX se atrasada ou vencendo em até 3 dias.
- Total em aberto: soma de todas as parcelas pendentes + atrasadas.

Se `proximaParcela === null` (sem contratos ativos): mostrar card vazio
com mensagem "Nenhuma parcela pendente".

## 3.5 — Últimas movimentações

- Listar últimos 5 pagamentos em ordem decrescente
- Formato: "Parc. {n}/{t} · Contrato #{num} · R$ {v} · {data}"
- Link "Ver tudo →" para `/portal/pagamentos`
- Se sem pagamentos: estado vazio com mensagem neutra

═══════════════════════════════════════════════════════════════════
PARTE 4 — CONTRATOS (`/portal/contratos`)
═══════════════════════════════════════════════════════════════════

## 4.1 — Lista de contratos (`page.tsx`)

```typescript
export function usePortalContratos() {
  return useQuery({
    queryKey: ['portal', 'contratos'],
    queryFn: () => portalApi.getContratos(),
    staleTime: 60_000,
  })
}
```

Card de contrato (`contrato-card.tsx`):
```
┌──────────────────────────────────────────────────┐
│  Contrato #2                     [ Ativo ]       │
│  R$ 1.400,00 · 5 parcelas · Mar 2026             │
│                                                  │
│  ████████░░░░░░░░░░░░ 40% (2 de 5 pagas)        │
│                                                  │
│  Próxima: R$ 280,00 · vence 25/05/2026           │
│                              [ Ver detalhes → ]  │
└──────────────────────────────────────────────────┘
```

Regras visuais do badge de status:
- `ativo` → azul (`b-info`)
- `quitado` → verde (`b-ok`)
- `inadimplente` → vermelho (`b-danger`)
- `cancelado` → cinza (`b-gray`)

Barra de progresso:
```typescript
// Cálculo: parcelasPagas / totalParcelas * 100
// Cor da barra:
// progressoPercentual === 100 → verde
// status === 'inadimplente' → vermelho
// default → azul
```

Estado vazio (nenhum contrato):
```
┌──────────────────────────────────────────────────┐
│        Nenhum contrato encontrado.               │
│        Em caso de dúvidas, entre em contato.     │
│        [ Abrir chamado de suporte ]              │
└──────────────────────────────────────────────────┘
```

## 4.2 — Detalhe do contrato (`/portal/contratos/[id]/page.tsx`)

```typescript
export function usePortalContratoDetalhe(id: number) {
  return useQuery({
    queryKey: ['portal', 'contratos', id],
    queryFn: () => portalApi.getContratoDetalhe(id),
    enabled: !!id,
  })
}
```

Layout:
```
┌──────────────────────────────────────────────────┐
│  ← Voltar        Contrato #2      [ Ativo ]      │
├──────────────────────────────────────────────────┤
│  RESUMO FINANCEIRO                               │
│  ──────────────────────────────────────────────  │
│  Valor emprestado     R$ 1.000,00                │
│  Total a pagar        R$ 1.400,00                │
│  Total pago           R$   560,00                │
│  Saldo restante       R$   840,00                │
│  Início               01/03/2026                 │
│  Pagamento            PIX                        │
│                                                  │
│  ████████░░░░░░░░░░░░ 40% concluído             │
├──────────────────────────────────────────────────┤
│  PARCELAS                                        │
│  ──────────────────────────────────────────────  │
│  1/5  01/04/26  R$280  ✅ Pago  10/04/26         │
│  2/5  01/05/26  R$280  ✅ Pago  10/05/26         │
│  3/5  01/06/26  R$280  🔵 Pendente               │
│                        [ Pagar com PIX → ]       │
│  4/5  01/07/26  R$280  ⏳ Aguardando            │
│  5/5  01/08/26  R$280  ⏳ Aguardando            │
└──────────────────────────────────────────────────┘
```

Componente `parcela-row.tsx` — regras de exibição:
- `pago`: mostrar data do pagamento. Sem ações.
- `pendente`: botão "Pagar com PIX →" que navega para
  `/portal/pagamentos/pix/[installmentId]`
- `atrasado`: mesmo botão do pendente, mas com texto em vermelho e
  badge "Atrasada" destacado
- `cancelado`: texto riscado, sem ações
- Status futuro (data > hoje + status pendente): exibir como
  "Aguardando" sem botão de ação

Campos NUNCA exibidos: `valorInvestido`, `taxaJuros`, `observacoes`,
`consultorId`, `modoTaxa`

═══════════════════════════════════════════════════════════════════
PARTE 5 — PAGAMENTO PIX (`/portal/pagamentos/pix/[installmentId]`)
═══════════════════════════════════════════════════════════════════

## 5.1 — Hook `use-portal-pix.ts`

```typescript
export function usePortalPix(installmentId: number) {
  const [pixData, setPixData] = useState<PixStatus | null>(null)
  const [fase, setFase] = useState<'carregando' | 'qrcode' | 'sucesso' | 'expirado'>('carregando')
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Gerar ou reutilizar QR Code ao montar
  useEffect(() => {
    async function iniciarPix() {
      const data = await portalApi.gerarPix(installmentId)
      setPixData(data)
      setFase('qrcode')
      iniciarPolling(data.pixId)
    }
    iniciarPix()

    // Cleanup obrigatório ao desmontar
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [installmentId])

  function iniciarPolling(pixId: number) {
    pollingRef.current = setInterval(async () => {
      const status = await portalApi.getPixStatus(pixId)

      if (status.status === 'aprovado') {
        clearInterval(pollingRef.current!)
        setPixData(status)
        setFase('sucesso')
      }

      if (status.status === 'expirado') {
        clearInterval(pollingRef.current!)
        setFase('expirado')
      }
    }, 10_000) // polling a cada 10 segundos
  }

  function regenerar() {
    if (pollingRef.current) clearInterval(pollingRef.current)
    setFase('carregando')
    // Força geração de novo QR Code
    portalApi.gerarPix(installmentId, { forcar: true }).then(data => {
      setPixData(data)
      setFase('qrcode')
      iniciarPolling(data.pixId)
    })
  }

  return { pixData, fase, regenerar }
}
```

## 5.2 — Tela do QR Code

```
┌──────────────────────────────────────────────────┐
│  ← Voltar              Pagar com PIX             │
├──────────────────────────────────────────────────┤
│  Contrato #2 · Parcela 3/5                       │
│  Vencimento: 01/06/2026                          │
│                                                  │
│  Valor a pagar                                   │
│  R$ 280,00                                       │
│                                                  │
│  ┌────────────────────────────────┐              │
│  │                                │              │
│  │     [QR CODE — 200×200px]      │              │
│  │     next/image, alt descritivo │              │
│  │                                │              │
│  └────────────────────────────────┘              │
│                                                  │
│  Copia e cola PIX:                               │
│  ┌──────────────────────────────┐ [📋 Copiar]   │
│  │ 00020126580014br.gov.bcb...  │               │
│  └──────────────────────────────┘               │
│                                                  │
│  ⏱ Válido por 28 minutos                        │
│  (timer regressivo atualizado a cada segundo)    │
│                                                  │
│  [ 📤 Compartilhar ]    [ 🔄 Novo QR Code ]      │
│                                                  │
│  ✓ Confirmação automática em até 5 minutos       │
│    após o pagamento ser aprovado.                │
└──────────────────────────────────────────────────┘
```

Detalhes técnicos:
- Timer regressivo: `useEffect` com `setInterval` de 1s calculando
  `expiresAt - now`. Ao zerar: setar `fase = 'expirado'`
- Botão "Copiar": usar `navigator.clipboard.writeText()`. Feedback:
  texto do botão muda para "Copiado!" por 2s
- Botão "Compartilhar": usar `navigator.share()` (Web Share API).
  Fallback: copiar para clipboard se API não disponível
- QR Code image: `<img src={pixData.qrImage} alt="QR Code PIX para pagamento de R$ {valor}"/>`

## 5.3 — Tela de QR Code expirado

```
┌──────────────────────────────────────────────────┐
│  ← Voltar              Pagar com PIX             │
├──────────────────────────────────────────────────┤
│                                                  │
│         ⏱ QR Code expirado                      │
│                                                  │
│   O código PIX de R$ 280,00 expirou.             │
│   Gere um novo para continuar.                   │
│                                                  │
│        [ 🔄 Gerar novo QR Code ]                 │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 5.4 — Tela de sucesso (`pix-sucesso.tsx`)

Exibida quando `fase === 'sucesso'`:
```
┌──────────────────────────────────────────────────┐
│                                                  │
│           ✅  Pagamento confirmado!              │
│                                                  │
│   Parcela 3/5 do Contrato #2                    │
│   R$ 280,00                                      │
│   Pago em 20/05/2026 às 14:32                   │
│                                                  │
│   Redirecionando em 3s...                        │
│                                                  │
│        [ Ver meu contrato ]                      │
│                                                  │
└──────────────────────────────────────────────────┘
```

Comportamento:
- Animação de entrada: escala de 0.8 → 1.0 com fade-in (CSS transition)
- `useEffect` com `setTimeout(3000)` → `router.push('/portal/contratos/[id]')`
- Invalidar React Query: `qc.invalidateQueries(['portal', 'home'])`
  e `qc.invalidateQueries(['portal', 'contratos'])`
- Cleanup do timeout se o usuário clicar no botão antes dos 3s

═══════════════════════════════════════════════════════════════════
PARTE 6 — HISTÓRICO DE PAGAMENTOS (`/portal/pagamentos/page.tsx`)
═══════════════════════════════════════════════════════════════════

```typescript
// Filtros disponíveis
interface FiltrosPagamentos {
  contratoId: number | 'todos'
  mes: string | 'todos'  // formato: 'YYYY-MM'
}
```

Layout com agrupamento por mês:
```
┌──────────────────────────────────────────────────┐
│  Histórico de Pagamentos                         │
│  [ Todos os contratos ▼ ]   [ Mês ▼ ]           │
├──────────────────────────────────────────────────┤
│  Maio 2026                                       │
│  ──────────────────────────────────────────────  │
│  10/05  Parc. 2/5 · Contrato #2  R$280  PIX ✅  │
├──────────────────────────────────────────────────┤
│  Abril 2026                                      │
│  ──────────────────────────────────────────────  │
│  10/04  Parc. 1/5 · Contrato #2  R$280  PIX ✅  │
│  05/04  Parc. 5/5 · Contrato #1  R$200  PIX ✅  │
└──────────────────────────────────────────────────┘
```

Agrupamento no frontend (não no backend):
```typescript
function agruparPorMes(pagamentos: UltimoPagamento[]) {
  return pagamentos.reduce((acc, pag) => {
    const chave = format(new Date(pag.dataPagamento), 'MMMM yyyy', { locale: ptBR })
    if (!acc[chave]) acc[chave] = []
    acc[chave].push(pag)
    return acc
  }, {} as Record<string, UltimoPagamento[]>)
}
```

Rótulo do método de pagamento:
```typescript
const labelMetodo = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  mercadopago: 'Mercado Pago',
}
```

Estado vazio: "Nenhum pagamento registrado ainda."

═══════════════════════════════════════════════════════════════════
PARTE 7 — SUPORTE (`/portal/suporte`)
═══════════════════════════════════════════════════════════════════

## 7.1 — Lista de tickets (`page.tsx`)

```
┌──────────────────────────────────────────────────┐
│  Suporte                   [ + Novo chamado ]    │
├──────────────────────────────────────────────────┤
│  #003  Dúvida sobre parcela                      │
│        Aberto em 18/05/2026       🟡 Aguardando  │
├──────────────────────────────────────────────────┤
│  #002  Erro no QR Code PIX         ● NÃO LIDO   │
│        Aberto em 10/05/2026       ✅ Respondido  │
│                            [ Ver resposta → ]    │
├──────────────────────────────────────────────────┤
│  #001  Solicitação de renegociação               │
│        Aberto em 01/04/2026       ✅ Resolvido   │
└──────────────────────────────────────────────────┘
```

Badge "● NÃO LIDO": visível quando `ticket.status === 'respondido'`
e `ticket.lido === false`. Ao clicar no ticket: chamar endpoint
`PATCH /api/portal/suporte/:id/lido` + remover badge.

Cor dos badges de status:
- `aberto` → amarelo
- `respondido` → azul
- `fechado` / `resolvido` → verde

Estado vazio:
```
┌──────────────────────────────────────────────────┐
│  Nenhum chamado aberto.                          │
│  [ Abrir meu primeiro chamado ]                  │
└──────────────────────────────────────────────────┘
```

## 7.2 — Detalhe do ticket (`/portal/suporte/[id]/page.tsx`)

```
┌──────────────────────────────────────────────────┐
│  ← Voltar        Ticket #002                     │
│                               ✅ Respondido      │
├──────────────────────────────────────────────────┤
│  Assunto: Erro no QR Code PIX                    │
│  Aberto em: 10/05/2026 às 09:15                  │
│  Contrato: #2 (se vinculado)                     │
├──────────────────────────────────────────────────┤
│  Sua mensagem                                    │
│  ──────────────────────────────────────────────  │
│  "Tentei gerar o QR Code mas apareceu um        │
│   erro na tela. Pode verificar?"                 │
├──────────────────────────────────────────────────┤
│  Resposta da equipe Lidera                       │
│  ──────────────────────────────────────────────  │
│  "Olá, João! O problema foi identificado e      │
│   corrigido. Por favor, tente novamente."        │
│                           Respondido em 11/05    │
└──────────────────────────────────────────────────┘
```

Ao carregar a página: chamar `PATCH /api/portal/suporte/:id/lido`
automaticamente se `ticket.lido === false`.

## 7.3 — Novo ticket (`/portal/suporte/novo/page.tsx`)

```
┌──────────────────────────────────────────────────┐
│  ← Voltar        Novo chamado de suporte         │
├──────────────────────────────────────────────────┤
│  Assunto *                                       │
│  ┌────────────────────────────────────────────┐  │
│  │ Selecione o assunto ▼                      │  │
│  │ • Dúvida sobre parcela                     │  │
│  │ • Problema com pagamento PIX               │  │
│  │ • Solicitação de renegociação              │  │
│  │ • Atualização de dados cadastrais          │  │
│  │ • Outro                                    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Contrato relacionado (opcional)                 │
│  ┌────────────────────────────────────────────┐  │
│  │ Selecione o contrato ▼                     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Mensagem *                                      │
│  ┌────────────────────────────────────────────┐  │
│  │                                            │  │
│  │                                            │  │
│  │                             0 / 500 chars  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  [ Cancelar ]          [ Enviar chamado → ]      │
└──────────────────────────────────────────────────┘
```

Validação client-side (react-hook-form + zod):
```typescript
const schema = z.object({
  assunto: z.string().min(1, 'Selecione um assunto'),
  loanId: z.number().optional(),
  mensagem: z.string()
    .min(10, 'Mensagem muito curta')
    .max(500, 'Máximo 500 caracteres'),
})
```

Após envio bem-sucedido:
- Invalidar cache: `qc.invalidateQueries(['portal', 'suporte'])`
- Redirecionar para `/portal/suporte`
- Exibir toast: "Chamado enviado! Nossa equipe responderá em breve."

═══════════════════════════════════════════════════════════════════
PARTE 8 — PERFIL E SEGURANÇA (`/portal/perfil/page.tsx`)
═══════════════════════════════════════════════════════════════════

## 8.1 — Layout completo

```
┌──────────────────────────────────────────────────┐
│  Meu Perfil                                      │
├──────────────────────────────────────────────────┤
│  DADOS PESSOAIS                                  │
│  ──────────────────────────────────────────────  │
│  Nome          João da Silva                     │
│  CPF           123.456.789-00                    │
│  Email         joao@email.com                    │
│  Telefone      (65) 99999-9999                   │
│                                                  │
│  ⚠ Para alterar seus dados, entre em contato     │
│    com a Lidera Financeira pelo suporte.         │
│    [ Abrir chamado de suporte ]                  │
├──────────────────────────────────────────────────┤
│  SEGURANÇA                                       │
│  ──────────────────────────────────────────────  │
│  Senha         ••••••••••••                      │
│                [ Alterar senha ]                 │
│                                                  │
│  Autenticação em dois fatores                    │
│  Google Authenticator                            │
│                                                  │
│  [Estado A] ⚠ Não configurado                   │
│  Você tem 3 acesso(s) antes de ser obrigatório.  │
│  [ Configurar Google Authenticator ]             │
│                                                  │
│  [Estado B] ✅ Ativo e configurado               │
│  [ Remover autenticação em dois fatores ]        │
├──────────────────────────────────────────────────┤
│  NOTIFICAÇÕES                                    │
│  ──────────────────────────────────────────────  │
│  WhatsApp    Lembretes e confirmações  [ ● ON ]  │
│  Email       Confirmações de pagamento [ ● ON ]  │
└──────────────────────────────────────────────────┘
```

## 8.2 — Modal de alteração de senha

```
┌──────────────────────────────────────────────────┐
│  Alterar senha                                   │
├──────────────────────────────────────────────────┤
│  Senha atual *                                   │
│  [ ____________________ ] 👁                    │
│                                                  │
│  Nova senha *                                    │
│  [ ____________________ ] 👁                    │
│                                                  │
│  Confirmar nova senha *                          │
│  [ ____________________ ] 👁                    │
│                                                  │
│  Requisitos:                                     │
│  ✅ Mínimo 8 caracteres                          │
│  ✅ Uma letra maiúscula                          │
│  ✅ Um número                                    │
│  ✅ Um caractere especial                        │
│                                                  │
│  [ Cancelar ]           [ Salvar senha ]         │
└──────────────────────────────────────────────────┘
```

Implementação:
```typescript
async function alterarSenha(senhaAtual: string, novaSenha: string) {
  // NOTA: este fluxo é apenas para clientes do portal (email real)
  // Operadores usam email fictício username@siafi.local internamente
  // 1. Verificar senha atual — reautenticar no Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email: cliente.email,
    password: senhaAtual,
  })
  if (error) throw new Error('Senha atual incorreta.')

  // 2. Atualizar senha
  await supabase.auth.updateUser({ password: novaSenha })

  // 3. Atualizar flag no backend
  await portalApi.patch('/perfil/primeiro-acesso', {
    senhaTemporaria: false,
    primeiroAcesso: false,
  })
}
```

## 8.3 — Seção de notificações

Dois toggles independentes com `PATCH /api/portal/notificacoes`:
```typescript
interface PreferenciasNotificacao {
  notificacoesWhatsapp: boolean
  notificacoesEmail: boolean
}
```

Feedback otimista: atualizar UI imediatamente, reverter em caso de erro.

## 8.4 — Seção MFA

Usar o estado `mfaEnabled` do cliente para renderizar:

Estado A (não configurado + dentro do prazo):
- Mostrar contagem regressiva: "X acesso(s) restantes"
- Botão "Configurar Google Authenticator" → navegar para `/portal/mfa-setup`

Estado B (não configurado + prazo esgotado):
- Não deve chegar aqui pois o middleware já redirecionou — mas como
  fallback: mostrar banner de urgência + botão de configuração

Estado C (configurado):
- Badge verde "Ativo"
- Botão "Remover autenticação em dois fatores" com confirmação modal

═══════════════════════════════════════════════════════════════════
PARTE 9 — TELAS DE ONBOARDING (fora do layout do portal)
═══════════════════════════════════════════════════════════════════

## 9.1 — Primeiro acesso (`/portal/primeiro-acesso/page.tsx`)

Layout centralizado sem header/footer do portal:
```
┌──────────────────────────────────────────────────┐
│           [LOGO LIDERA]                          │
│                                                  │
│      Bem-vindo ao Portal Lidera! 🎉              │
│                                                  │
│  Por segurança, defina sua senha pessoal         │
│  antes de continuar.                             │
│                                                  │
│  Nova senha *                                    │
│  [ ____________________ ] 👁                    │
│                                                  │
│  Confirmar senha *                               │
│  [ ____________________ ] 👁                    │
│                                                  │
│  Força da senha:  [████████░░] Boa              │
│                                                  │
│  ✅ 8+ caracteres   ✅ Maiúscula                 │
│  ✅ Número          ✅ Especial                  │
│                                                  │
│  [ Salvar senha e continuar → ]                  │
└──────────────────────────────────────────────────┘
```

Indicador de força da senha (PasswordStrength):
- Fraca (1): apenas letras → vermelho
- Média (2): letras + número → amarelo
- Boa (3): 3 requisitos → azul
- Forte (4): todos os requisitos → verde

Após salvar:
1. `supabase.auth.updateUser({ password: novaSenha })`
2. `PATCH /api/portal/perfil/primeiro-acesso`
3. Verificar se MFA obrigatório → `/portal/mfa-setup`
4. Senão → `/portal` com toast de boas-vindas

## 9.2 — Setup MFA (`/portal/mfa-setup/page.tsx`)

```
┌──────────────────────────────────────────────────┐
│           [LOGO LIDERA]                          │
│                                                  │
│      Configure o Google Authenticator            │
│                                                  │
│  1. Instale o app Google Authenticator           │
│     no seu celular                               │
│                                                  │
│  2. Escaneie o QR Code abaixo:                   │
│                                                  │
│     ┌─────────────────────┐                      │
│     │   [QR CODE TOTP]    │                      │
│     └─────────────────────┘                      │
│                                                  │
│     Ou use o código manual:                      │
│     JBSWY3DPEHPK3PXP  [ 📋 Copiar ]             │
│                                                  │
│  3. Digite o código gerado pelo app:             │
│                                                  │
│     [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]              │
│            (6 dígitos)                           │
│                                                  │
│  [ Voltar ]        [ Ativar proteção → ]         │
│                                                  │
│  {Se prazo ainda válido: }                       │
│  [ Configurar depois ({X} acessos restantes) ]   │
└──────────────────────────────────────────────────┘
```

Input OTP de 6 dígitos:
- 6 `<input type="text" maxLength={1}>` separados
- Auto-focus para próximo campo ao digitar
- Auto-submit ao completar os 6 dígitos
- Suporte a colar código completo (split nos campos)
- Acessibilidade: `aria-label="Dígito {n} do código de autenticação"`

Ao confirmar:
1. `supabase.auth.mfa.challengeAndVerify({ factorId, code })`
2. `PATCH /api/portal/perfil/mfa` → `{ mfaEnabled: true }`
3. Navegar para `/portal` com toast "Conta protegida!"

## 9.3 — Challenge MFA (`/portal/mfa-challenge/page.tsx`)

Exibida após login quando usuário tem MFA ativo:
```
┌──────────────────────────────────────────────────┐
│           [LOGO LIDERA]                          │
│                                                  │
│      Verificação em dois fatores                 │
│                                                  │
│  Abra o Google Authenticator e digite            │
│  o código de 6 dígitos:                          │
│                                                  │
│     [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ]              │
│                                                  │
│  O código se renova a cada 30 segundos.          │
│                                                  │
│                    [ Verificar → ]               │
│                                                  │
│  Não consigo acessar meu autenticador            │
│  → abre novo ticket de suporte                  │
└──────────────────────────────────────────────────┘
```

═══════════════════════════════════════════════════════════════════
PARTE 10 — BACKEND: ENDPOINTS ADICIONAIS DA FASE 3
═══════════════════════════════════════════════════════════════════

Os endpoints da Fase 2 já existem. Adicionar apenas:

```
PATCH /api/portal/suporte/:id/lido
      → marcar ticket como lido (lido: true)
      → ClientPortalGuard + validar ownership

PATCH /api/portal/perfil/mfa
      → { mfaEnabled: boolean } → atualizar no Prisma

GET   /api/portal/contratos/:id/parcelas
      → lista detalhada de parcelas de um contrato
      → validar ownership obrigatório
```

`ClientPortalService` — adicionar método `marcarTicketLido`:
```typescript
async marcarTicketLido(ticketId: number, clientId: number) {
  const ticket = await this.prisma.supportTicket.findFirst({
    where: { id: ticketId, clientId }
  });
  if (!ticket) throw new ForbiddenException('Acesso negado.');
  return this.prisma.supportTicket.update({
    where: { id: ticketId },
    data: { lido: true }
  });
}
```

Adicionar campo `lido` no model `SupportTicket`:
```prisma
model SupportTicket {
  // ... campos existentes ...
  lido      Boolean @default(false)
}
```

═══════════════════════════════════════════════════════════════════
PARTE 11 — ACESSIBILIDADE E UX MOBILE
═══════════════════════════════════════════════════════════════════

## 11.1 — Requisitos de acessibilidade (WCAG AA)

- Contraste mínimo 4.5:1 para texto normal, 3:1 para texto grande
- Todo elemento interativo acessível via teclado (`Tab`, `Enter`, `Space`)
- `aria-label` em ícones sem texto: `<button aria-label="Copiar código PIX">`
- `aria-live="polite"` no banner de alerta (atualiza dinamicamente)
- `aria-live="assertive"` no toast de sucesso do pagamento
- `role="status"` nos estados de loading
- Imagem do QR Code: `alt="QR Code PIX para pagamento de R$ {valor}"`
- Input OTP: `aria-label="Dígito {n} do código de autenticação"`
- Foco visível em todos os elementos interativos

## 11.2 — Estados de loading

Cada página deve ter skeleton loading adequado:
```typescript
// Skeleton da home
function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-12 rounded-lg" />
      <Skeleton className="h-32 rounded-lg" />
    </div>
  )
}
```

## 11.3 — Toast notifications

Implementar com shadcn/ui `<Sonner>` ou similar:
- Sucesso: verde, 4s, ícone ✓
- Erro: vermelho, 6s, ícone ✕, mensagem genérica para o cliente
- Info: azul, 3s, ícone ℹ

## 11.4 — Tratamento de erros

```typescript
// ErrorBoundary para cada rota do portal
// Em caso de erro 401: redirecionar para /login
// Em caso de erro 403: exibir mensagem "Acesso não autorizado"
// Em caso de erro 500: exibir mensagem genérica + botão "Tentar novamente"
// NUNCA exibir mensagens técnicas do Prisma ou Supabase para o cliente
```

## 11.5 — Performance mobile

- `next/image` com `loading="lazy"` em todas as imagens exceto LCP
- `React.lazy` + `Suspense` para componentes pesados
- `staleTime` adequado em cada query (home: 30s, contratos: 60s)
- Evitar re-renders desnecessários: memoizar callbacks com `useCallback`

═══════════════════════════════════════════════════════════════════
PARTE 12 — ENTREGÁVEIS DA FASE 3 (em ordem de dependência)
═══════════════════════════════════════════════════════════════════

### Pré-requisito obrigatório (entregar antes de tudo)
0.  Instalar e configurar Supabase SSR:
    ```bash
    npm install @supabase/ssr @supabase/supabase-js
    ```
    Criar:
    - `src/lib/supabase/client.ts` → `createBrowserClient(url, anonKey)`
    - `src/lib/supabase/server.ts` → `createServerClient(url, anonKey, { cookies })`
    - Estas funções já devem existir da Fase 1 — verificar antes de recriar

### Infraestrutura (entregar primeiro)
1.  `src/lib/portal/portal-types.ts` — todas as interfaces TypeScript
2.  `src/lib/portal/portal-api.ts` — funções axios para /api/portal/*
3.  `src/hooks/portal/use-realtime-portal.ts` — Realtime + cleanup
4.  `src/hooks/portal/use-portal-home.ts`
5.  `src/hooks/portal/use-portal-contratos.ts`
6.  `src/hooks/portal/use-portal-pix.ts` — polling + cleanup + regenerar
7.  `src/hooks/portal/use-portal-suporte.ts`

### Layout e componentes base
8.  `(portal)/layout.tsx` — QueryClient + header + footer + Realtime init
9.  `portal-header.tsx` — sticky, badge, sair
10. `portal-footer.tsx`

### Onboarding (sem layout do portal)
11. `/portal/primeiro-acesso/page.tsx` — com PasswordStrength
12. `/portal/mfa-setup/page.tsx` — QR Code + input OTP 6 dígitos
13. `/portal/mfa-challenge/page.tsx` — input OTP + link suporte

### Páginas do portal
14. `/portal/page.tsx` — home com cards, banners e movimentações
15. `/portal/contratos/page.tsx` — lista com skeleton e estado vazio
16. `/portal/contratos/[id]/page.tsx` — detalhe + tabela de parcelas
17. `/portal/pagamentos/pix/[installmentId]/page.tsx` — QR + polling + timer + sucesso + expirado
18. `/portal/pagamentos/page.tsx` — histórico agrupado por mês
19. `/portal/suporte/page.tsx` — lista + badge não lido
20. `/portal/suporte/[id]/page.tsx` — detalhe + marcar lido automático
21. `/portal/suporte/novo/page.tsx` — formulário com validação zod
22. `/portal/perfil/page.tsx` — dados + senha + MFA + notificações

### Backend adicional
23. Migration: campo `lido` em `SupportTicket`
24. `PATCH /api/portal/suporte/:id/lido` endpoint
25. `PATCH /api/portal/perfil/mfa` endpoint

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════════
- Mobile first em TODAS as telas — testar em viewport 375px
- TODA query filtra por clientId do JWT — sem exceção em nenhum endpoint
- Polling do PIX: cleanup no return do useEffect — sem memory leak
- Realtime: supabase.removeChannel() no return do useEffect
- NUNCA exibir para o cliente: valorInvestido, taxaJuros, observacoes,
  consultorId, dados internos do sistema
- Erros de API: mensagem genérica ao cliente, nunca stack trace
- QR Code: reutilizar se não expirado, gerar novo apenas quando necessário
- Acessibilidade WCAG AA: aria-labels, contraste, navegação por teclado
- Toast feedback em toda ação do usuário (sucesso e erro)
- Skeleton loading em toda página com dados assíncronos
- Estado vazio tratado em toda listagem
- react-hook-form + zod em todo formulário
- useCallback e useMemo onde evitar re-renders importa (polling, Realtime)
```
