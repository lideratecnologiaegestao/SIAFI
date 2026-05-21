# SIAFI 2.0 — Guia do Frontend (Next.js)

> Última atualização: 2026-05-22 | Next.js 16 · TypeScript 5 · Tailwind CSS 4

---

## Estrutura de Diretórios

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           → Login username+senha / Google
│   │   └── mfa-setup/page.tsx       → Configuração MFA TOTP
│   ├── (dashboard)/                 → Layout com sidebar (operadores internos)
│   │   ├── layout.tsx               → Sidebar + Topbar + AuthGuard
│   │   ├── dashboard/page.tsx       → KPIs + listas resumidas
│   │   ├── clientes/
│   │   │   ├── page.tsx             → Lista + busca + vincular consultor
│   │   │   ├── novo/page.tsx        → Formulário com docs + consultor
│   │   │   └── [id]/
│   │   │       ├── page.tsx         → Detalhe + contratos + score + portal
│   │   │       └── editar/page.tsx  → Edição completa
│   │   ├── emprestimos/
│   │   │   ├── page.tsx             → Lista + filtros + somas por status
│   │   │   ├── novo/page.tsx        → Criação + config. cobrança + simulador
│   │   │   └── [id]/page.tsx        → Detalhe + parcelas + cobranças (tabs)
│   │   ├── parcelas/page.tsx        → Parcelas em atraso
│   │   ├── pagamentos/
│   │   │   ├── page.tsx             → Histórico + estorno
│   │   │   └── novo/page.tsx        → cliente → loan → parcela → pagar
│   │   ├── inadimplentes/page.tsx   → Carteira inadimplente
│   │   ├── caixa/page.tsx           → Saldo + transações + lançamento
│   │   ├── renegociacoes/
│   │   │   ├── page.tsx
│   │   │   └── nova/page.tsx
│   │   ├── reparcelamentos/
│   │   │   ├── page.tsx             → Lista + proposta + aprovação + execução
│   │   │   └── nova/page.tsx        → Formulário + simulador inline
│   │   ├── intencoes/page.tsx       → Intenções com SLA + score
│   │   ├── solicitacoes/page.tsx    → Solicitações do consultor
│   │   ├── cobrancas/page.tsx       → Cobranças da carteira (consultor)
│   │   ├── consultor/
│   │   │   └── carteira/
│   │   │       ├── page.tsx         → Visão da carteira
│   │   │       └── [clientId]/page.tsx → Detalhe do cliente (consultor)
│   │   ├── pix/page.tsx             → Gerador QR Code PIX
│   │   ├── conciliacao/page.tsx     → Conciliação bancária mensal
│   │   ├── relatorios/page.tsx      → 5 abas: carteira, clientes, movim., contratos, faturamento
│   │   ├── mensagens/page.tsx       → Chat interno + Supabase Realtime
│   │   ├── notificacoes/page.tsx    → Log de notificações
│   │   ├── suporte/page.tsx         → Tickets de suporte
│   │   ├── usuarios/
│   │   │   ├── page.tsx
│   │   │   ├── novo/page.tsx
│   │   │   └── [id]/editar/page.tsx
│   │   ├── configuracoes/page.tsx   → Parâmetros admin
│   │   └── auditoria/page.tsx       → Log de auditoria com detalhes expandíveis
│   ├── portal/                      → Portal do cliente (role=cliente)
│   │   ├── layout.tsx
│   │   ├── home/page.tsx
│   │   ├── contratos/page.tsx
│   │   ├── pagamentos/page.tsx      → PIX via QR Code
│   │   ├── suporte/page.tsx
│   │   └── perfil/page.tsx
│   └── auth/callback/route.ts       → Callback Google OAuth
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx              → Menu lateral com badges e grupos por role
│   │   └── topbar.tsx               → Header com usuário e logout
│   ├── portal/
│   │   └── portal-card.tsx          → Card de status do portal (em /clientes/[id])
│   └── ui/                          → button, input, card, badge, skeleton, select, textarea, label
├── contexts/
│   └── auth.context.tsx             → AuthProvider + useAuth() + AuthUser
├── hooks/
│   └── useUnreadCount.ts            → Badge de mensagens não-lidas
└── lib/
    ├── api.ts                       → Axios instance + interceptor refresh JWT
    ├── utils.ts                     → formatCurrency, formatDate, formatCPF, etc.
    └── supabase/client.ts           → Supabase browser client (Realtime)
```

---

## AuthContext e Proteção de Rotas

```typescript
// contexts/auth.context.tsx
export interface AuthUser {
  id: number
  username: string
  nome: string
  role: 'admin' | 'financeiro' | 'consultor' | 'caixa' | 'cliente'
}

export function useAuth() {
  return useContext(AuthContext) // { user, isLoading, isAuthenticated, login, logout }
}

// layout.tsx do dashboard — proteção automática
'use client'
const { user, isLoading } = useAuth()
if (!isLoading && !user) redirect('/login')
if (user?.role === 'cliente') redirect('/portal/home')
```

### Verificação de Role nos Componentes

```typescript
const { user } = useAuth()
const canManage = user?.role === 'admin' || user?.role === 'financeiro'
const isConsultor = user?.role === 'consultor'

// Renderização condicional
{canManage && <Button onClick={handleVincular}>Vincular Consultor</Button>}
```

---

## Interceptor de Refresh JWT

```typescript
// lib/api.ts — interceptor automático de 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      const { data } = await axios.post('/api/auth/refresh', { refreshToken })
      tokenStore.set(data.accessToken)
      error.config.headers.Authorization = `Bearer ${data.accessToken}`
      return api(error.config)
    }
    return Promise.reject(error)
  }
)
```

---

## Padrão de Página de Lista

```typescript
'use client'
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: ['entidade', { search, status, page }],
  queryFn: () => api.get('/endpoint', { params: { search, status, page, limit: 20 } })
    .then(r => r.data),
})

const mutation = useMutation({
  mutationFn: (id: number) => api.delete(`/endpoint/${id}`),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['entidade'] }),
})
```

---

## Padrão de Formulário

```typescript
const schema = z.object({
  nome: z.string().min(3),
  consultorId: z.string().optional(),      // select → string no form, number na API
  multaPercentual: z.number().min(0).max(1),
})

const { register, handleSubmit, control } = useForm<FormData>({
  resolver: zodResolver(schema) as any,    // cast necessário Zod v4 + react-hook-form
})

// Campos com máscara (CPF, moeda): usar <Controller>
<Controller
  name="cpf"
  control={control}
  render={({ field }) => (
    <Input
      value={formatCpfCnpj(field.value ?? '')}
      onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
    />
  )}
/>
```

---

## Realtime (Chat Interno)

```typescript
// hooks/useUnreadCount.ts — polling 30s + Supabase Realtime
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = getSupabaseBrowserClient()
supabase
  .channel('mensagens-inseridas')
  .on(
    'postgres_changes' as any,  // cast necessário (tipagem Supabase)
    { event: 'INSERT', schema: 'public', table: 'mensagens' },
    () => qc.invalidateQueries({ queryKey: ['mensagens-badge'] })
  )
  .subscribe()
```

---

## Rotas por Role (Sidebar)

| Rota | Admin | Financeiro | Caixa | Consultor |
|------|-------|-----------|-------|-----------|
| /dashboard | ✅ | ✅ | ✅ | ✅ |
| /clientes | ✅ | ✅ | ✅ | — |
| /emprestimos | ✅ | ✅ | — | — |
| /parcelas | ✅ | ✅ | ✅ | — |
| /pagamentos | ✅ | ✅ | ✅ | — |
| /inadimplentes | ✅ | ✅ | — | — |
| /caixa | ✅ | ✅ | ✅ | — |
| /reparcelamentos | ✅ | ✅ | — | ✅ |
| /intencoes | ✅ | ✅ | — | ✅ |
| /solicitacoes | ✅ | ✅ | — | ✅ |
| /cobrancas | ✅ | ✅ | — | ✅ |
| /consultor/carteira | ✅ | ✅ | — | ✅ |
| /relatorios | ✅ | ✅ | — | — |
| /mensagens | ✅ | ✅ | ✅ | ✅ |
| /configuracoes | ✅ | — | — | — |
| /auditoria | ✅ | — | — | — |
| /usuarios | ✅ | — | — | — |

---

## Funções Utilitárias (lib/utils.ts)

```typescript
formatCurrency(valor: number | string): string
// R$ 1.234,56

formatDate(date: string | Date): string
// 21/05/2026

formatDateTime(date: string | Date): string
// 21/05/2026, 14:30

formatCPF(cpf: string): string
// 000.000.000-00

formatPhone(phone: string): string
// (65) 99999-9999

formatCEP(cep: string): string
// 00000-000

STATUS_LOAN: Record<string, { label: string; variant: BadgeVariant }>
// ativo, quitado, cancelado, atrasado, aguardando_aceite, aguardando_liberacao
```

---

## Componentes UI Disponíveis

```
components/ui/
├── button.tsx      → variant: default|outline|ghost|destructive; size: sm|default|lg
├── input.tsx       → padrão HTML input com estilo
├── textarea.tsx    → área de texto com resize
├── select.tsx      → select nativo estilizado
├── label.tsx       → label acessível
├── card.tsx        → Card, CardHeader, CardTitle, CardContent
├── badge.tsx       → variant: default|outline|success|secondary|destructive
└── skeleton.tsx    → placeholder de carregamento
```

---

## Regras de Formatação

- **Dados monetários:** sempre `formatCurrency()` — nunca `toFixed()` direto
- **Datas:** sempre `formatDate()` ou `formatDateTime()`
- **Simulações financeiras:** `decimal.js` no cliente — nunca `Math.round()` em dinheiro
- **Operações destrutivas:** `confirm()` obrigatório antes de executar
- **Rotas:** sempre em **português** (`/clientes`, `/emprestimos`, `/pagamentos`)
- **Score:** exibir sempre como 0–100 com classificação textual (Baixo/Médio/Alto/Excelente)

---

## Auditoria — Página /auditoria

A página de auditoria exibe o log de todas as ações do sistema com:

- **Filtro por ação** (ex: `EMAIL_ENVIADO`, `EMAIL_FALHOU`, `LOGIN`, `PORTAL_ATIVADO`)
- **Filtro por entidade** (ex: `client`, `email`, `loan`)
- **Botões de atalho** para ações frequentes
- **Linha clicável** expande detalhes (`contexto` com JSON formatado)
- **Codificação por cor:**
  - Verde: `ENVIADO`, `ATIVADO`, `APROVADO`, `EXECUTADO`, `LIBERADO`
  - Vermelho: `FALHOU`, `ERRO`, `BLOQUEADO`, `NEGADO`
  - Amarelo: `IGNORADO`, `PENDENTE`, `AVISO`
  - Azul: ações de `EMAIL`

---

## Build e Verificação

```bash
# Type check
npx tsc --noEmit

# Build de produção
npm run build

# Verificar erros nas páginas de clientes
npx tsc --noEmit 2>&1 | grep clientes

# Restart
sc.exe stop SIAFI-WEB && sleep 3 && sc.exe start SIAFI-WEB
```
