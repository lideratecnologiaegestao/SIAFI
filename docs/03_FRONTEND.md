# SIAFI 2.0 — Guia do Frontend (Next.js)
> Última atualização: 2026-05-23 | Next.js 16 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui

---

## 1. Estrutura de Diretórios

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   └── login/                      ← Login + OAuth Google + MFA
│   ├── (dashboard)/                    ← Layout compartilhado: Sidebar + Topbar
│   │   ├── portal-layout-content.tsx   ← Layout condicional por role
│   │   ├── dashboard/                  ← Dashboard renderizado por perfil
│   │   ├── clientes/                   ← Lista · novo · [id] · [id]/editar
│   │   ├── emprestimos/                ← Lista · novo · [id]
│   │   ├── parcelas/                   ← Parcelas em atraso
│   │   ├── pagamentos/                 ← Histórico · novo
│   │   ├── caixa/                      ← Saldo + movimentações + lançamentos
│   │   ├── inadimplentes/              ← Carteira inadimplente global
│   │   ├── renegociacoes/              ← Lista · nova
│   │   ├── reparcelamentos/            ← Lista · nova · [id]
│   │   ├── intencoes/                  ← Lista · [id]
│   │   ├── solicitacoes/               ← Solicitações ao financeiro
│   │   ├── cobrancas/                  ← Cobranças da carteira do consultor
│   │   ├── consultor/carteira/         ← Carteira do consultor
│   │   ├── pix/                        ← Gerador QR Code PIX
│   │   ├── conciliacao/                ← Conciliação bancária
│   │   ├── relatorios/                 ← 5 abas de relatório
│   │   ├── mensagens/                  ← Chat interno + Realtime
│   │   ├── notificacoes/               ← Log de notificações
│   │   ├── suporte/                    ← Tickets · [id] · novo
│   │   ├── usuarios/                   ← Lista · novo · [id]/editar
│   │   ├── configuracoes/              ← Parâmetros + templates + integrações
│   │   └── auditoria/                  ← Log de auditoria
│   └── (portal)/                       ← Layout do portal do cliente
│       └── portal/
│           ├── page.tsx                ← Home: contratos + progresso
│           ├── contratos/[id]/         ← Detalhe do contrato + parcelas
│           ├── pagamentos/             ← Histórico de pagamentos
│           ├── pagamentos/pix/[installmentId]/ ← Tela de pagamento PIX
│           ├── suporte/                ← Chamados · novo · [id]
│           └── perfil/                 ← Senha · 2FA · preferências
├── components/
│   ├── ui/                 ← shadcn/ui: button, input, card, badge, skeleton, select, textarea
│   ├── layout/             ← Sidebar, Topbar, BottomNav (portal mobile)
│   └── portal/             ← Componentes exclusivos do portal do cliente
├── hooks/                  ← Hooks customizados
├── lib/
│   ├── api.ts              ← Axios com interceptors JWT e refresh automático
│   ├── utils.ts            ← formatCurrency, formatDate, formatDateTime
│   └── supabase/
│       └── client.ts       ← Supabase browser client (Realtime)
└── styles/                 ← Estilos globais Tailwind
```

---

## 2. Route-Role Guard

Todas as rotas do grupo `(dashboard)` são protegidas pelo `RouteRoleGuard` via `middleware.ts`. O objeto `ROUTE_ROLES` mapeia rota → roles permitidas:

| Rota | Roles permitidas |
|------|----------------|
| `/dashboard` | admin, financeiro, consultor, caixa, cliente |
| `/clientes` | admin, financeiro, caixa |
| `/clientes/novo` | admin, financeiro |
| `/clientes/[id]` | admin, financeiro, caixa |
| `/clientes/[id]/editar` | admin, financeiro |
| `/emprestimos` | admin, financeiro |
| `/emprestimos/novo` | admin, financeiro |
| `/emprestimos/[id]` | admin, financeiro, caixa |
| `/parcelas` | admin, financeiro, caixa |
| `/pagamentos` | admin, financeiro, caixa |
| `/pagamentos/novo` | admin, financeiro, caixa |
| `/caixa` | admin, financeiro, caixa |
| `/inadimplentes` | admin, financeiro |
| `/renegociacoes` | admin, financeiro |
| `/renegociacoes/nova` | admin, financeiro |
| `/reparcelamentos` | admin, financeiro, consultor |
| `/reparcelamentos/nova` | admin, financeiro, consultor |
| `/reparcelamentos/[id]` | admin, financeiro, consultor |
| `/intencoes` | admin, financeiro, consultor |
| `/intencoes/[id]` | admin, financeiro, consultor |
| `/solicitacoes` | admin, financeiro, consultor |
| `/cobrancas` | admin, financeiro, consultor |
| `/consultor/carteira` | consultor, admin, financeiro |
| `/pix` | admin, financeiro, consultor |
| `/conciliacao` | admin, financeiro |
| `/relatorios` | admin, financeiro |
| `/mensagens` | admin, financeiro, consultor, caixa |
| `/notificacoes` | admin, financeiro |
| `/suporte` | admin, financeiro, caixa |
| `/suporte/[id]` | admin, financeiro, caixa |
| `/suporte/novo` | admin, financeiro, caixa |
| `/usuarios` | admin |
| `/usuarios/novo` | admin |
| `/usuarios/[id]/editar` | admin |
| `/configuracoes` | admin |
| `/auditoria` | admin |
| `/portal/*` | cliente |

---

## 3. AuthContext e Session

`AuthContext` (Provider em `app/layout.tsx`) expõe:

```typescript
const { user, role, isLoading, signOut } = useAuth()
```

**Refresh automático:** interceptor Axios detecta 401 → `POST /api/auth/refresh` → repete a request original. Se o refresh falhar → `signOut()` + redirect `/login`.

**Redirect no login:** `admin`/`financeiro`/`consultor`/`caixa` → `/dashboard`; `cliente` → `/portal`.

---

## 4. Dashboards por Perfil

`/dashboard/page.tsx` renderiza condicionalmente com base na `role` do `AuthContext`:

| Role | Componente | Foco principal |
|------|-----------|---------------|
| admin, financeiro | `DashboardFinanceiro` | KPIs financeiros, Fila SLA, Liberações pendentes, Aging |
| consultor | `DashboardConsultor` | Carteira, cobranças urgentes, intenções pendentes |
| caixa | `DashboardCaixa` | Liberações pendentes, parcelas do dia, saldo atual |

---

## 5. Layout: Sidebar, Topbar, BottomNav

**Sidebar** — grupos filtrados pela `role`:

| Grupo | Itens | Roles |
|-------|-------|-------|
| Início | Dashboard | todos |
| Operacional | Clientes, Empréstimos, Parcelas, Pagamentos, Caixa | admin, financeiro, caixa |
| Consultor | Minha Carteira, Intenções, Solicitações, Cobranças | consultor |
| Financeiro | Inadimplentes, Reparcelamentos, PIX, Renegociações, Conciliação | admin, financeiro |
| Relatórios | Relatórios | admin, financeiro |
| Comunicação | Mensagens (com badge), Notificações, Suporte | admin, financeiro, consultor, caixa |
| Administração | Usuários, Configurações, Auditoria | admin |

**Topbar** — nome do usuário, badge de mensagens não lidas (polling 30s + Realtime), botão sair.

**BottomNav** — navegação inferior para o portal do cliente (mobile-first). Itens: Início, Parcelas, PIX, Suporte, Perfil.

---

## 6. Padrão de Página de Lista

```typescript
'use client'
export default function ListaPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['entidade'],
    queryFn: () => api.get('/endpoint').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/endpoint/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['entidade'] }),
  })

  if (isLoading) return <SkeletonCard />
  return <DataTable data={data} ... />
}
```

---

## 7. Formulários

```typescript
const form = useForm<Schema>({
  resolver: zodResolver(schema) as any, // cast necessário — Zod v4 + react-hook-form
})
```

Upload de documentos: `FormData` com `Content-Type: multipart/form-data`.

Operações destrutivas sempre precedidas de `confirm()` antes de executar a mutation.

---

## 8. Dados Financeiros

| Regra | Detalhe |
|-------|---------|
| Exibição | Sempre `formatCurrency(value)` — nunca exibir número bruto |
| Datas | `formatDate()` para dd/MM/yyyy · `formatDateTime()` para dd/MM/yyyy HH:mm |
| Cálculos no cliente | `Decimal.js` — nunca `Math.round()` ou operações nativas com `float` |
| Realtime cast | `'postgres_changes' as any` — necessário por tipagem incompleta do SDK Supabase |

---

## 9. Supabase Realtime no Frontend

```typescript
// Escutar novas mensagens de uma conversa
supabase
  .channel(`conversa-${id}`)
  .on('postgres_changes' as any, {
    event: 'INSERT',
    schema: 'public',
    table: 'mensagens',
    filter: `conversa_id=eq.${id}`,
  }, (payload) => {
    // atualizar lista de mensagens
  })
  .subscribe()
```

---

## 10. Hooks Customizados

| Hook | Descrição |
|------|-----------|
| `useAuth()` | Usuário, role, signOut do AuthContext |
| `useUnreadCount()` | Badge de mensagens não lidas (polling 30s) |
| `useMensagensNaoLidas()` | Contagem de não-lidas por conversa |
| `useConversaRealtime(id)` | Realtime de uma conversa específica |
| `useRealtimePortal()` | Realtime de installments e payments no portal do cliente |
| `usePortalPix(installmentId)` | Geração e polling de confirmação de QR Code PIX no portal |
| `useEmailTemplate(type)` | Carregar, editar e salvar template de e-mail |
| `useScoreRisco(clientId)` | Score do cliente com invalidação automática pós-pagamento |

---

## 11. Componentes Reutilizáveis do Portal

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `MoneyDisplay` | `portal/money-display.tsx` | Valor monetário formatado com tamanho configurável |
| `ProgressBar` | `portal/progress-bar.tsx` | Barra de progresso das parcelas pagas |
| `StatusBadge` | `portal/status-badges.tsx` | Badge colorido por status de parcela ou contrato |
| `SkeletonCard` | `portal/skeleton-card.tsx` | Skeleton de carregamento padrão do portal |
| `PCard` | `portal/p-card.tsx` | Card padrão do portal (wrapper estilizado) |
| `ScoreIndicator` | `portal/score-indicator.tsx` | Indicador visual do score de risco (0–100) |
| `PixCopyButton` | `portal/pix-copy-button.tsx` | Botão copia-e-cola com feedback visual de copiado |

---

## 12. Componentes de Negócio

| Componente | Descrição |
|------------|-----------|
| `SimuladorReparcelamento` | Simulação inline com `Decimal.js` — exibe parcelas e totais sem gravar |
| `ScoreRiscoCard` | Card com score, histórico de fatores e classificação de risco |
| `EmailPreview` | Preview renderizado do template de e-mail com variáveis substituídas |
| `AceiteDigital` | Tela de revisão e assinatura do contrato no portal do cliente |
| `LiberacaoCapital` | Formulário de confirmação de entrega do capital (perfil caixa) |

---

## 13. API Client

`lib/api.ts` — instância Axios configurada:

- `baseURL`: `process.env.NEXT_PUBLIC_API_URL`
- **Request interceptor:** injeta `Authorization: Bearer <accessToken>`
- **Response interceptor:** em 401 → `POST /api/auth/refresh` → repete a request; em falha → `signOut()` + redirect `/login`

---

## 14. Rotas Completas por Perfil

| Rota | Roles | Descrição |
|------|-------|-----------|
| `/login` | público | Login + Google + MFA |
| `/dashboard` | todos | Dashboard condicional por perfil |
| `/clientes` | admin, financeiro, caixa | Lista paginada com busca |
| `/clientes/novo` | admin, financeiro | Cadastro com upload de documentos |
| `/clientes/[id]` | admin, financeiro, caixa | Detalhe + contratos + score |
| `/clientes/[id]/editar` | admin, financeiro | Edição de dados cadastrais |
| `/emprestimos` | admin, financeiro | Lista com filtros e soma por status |
| `/emprestimos/novo` | admin, financeiro | Criação + simulador inline |
| `/emprestimos/[id]` | admin, financeiro, caixa | Detalhe + pagamento rápido |
| `/parcelas` | admin, financeiro, caixa | Parcelas em atraso |
| `/pagamentos` | admin, financeiro, caixa | Histórico + estorno |
| `/pagamentos/novo` | admin, financeiro, caixa | Registrar pagamento (CPF → parcela) |
| `/caixa` | admin, financeiro, caixa | Saldo + extrato + lançamentos |
| `/inadimplentes` | admin, financeiro | Carteira inadimplente global |
| `/renegociacoes` | admin, financeiro | Lista de renegociações |
| `/renegociacoes/nova` | admin, financeiro | Formulário de renegociação |
| `/reparcelamentos` | admin, financeiro, consultor | Lista + fluxo de aprovação |
| `/reparcelamentos/nova` | admin, financeiro, consultor | Formulário + simulador |
| `/reparcelamentos/[id]` | admin, financeiro, consultor | Detalhe + ações por etapa |
| `/intencoes` | admin, financeiro, consultor | Lista com SLA e status |
| `/intencoes/[id]` | admin, financeiro, consultor | Detalhe + aprovar/rejeitar |
| `/solicitacoes` | admin, financeiro, consultor | Solicitações ao financeiro |
| `/cobrancas` | admin, financeiro, consultor | Cobranças + registro de contato |
| `/consultor/carteira` | consultor, admin, financeiro | Carteira do consultor |
| `/pix` | admin, financeiro, consultor | Gerador de QR Code PIX |
| `/conciliacao` | admin, financeiro | Conciliação bancária |
| `/relatorios` | admin, financeiro | 5 abas: carteira, faturamento, clientes, movimentação, contratos |
| `/mensagens` | admin, financeiro, consultor, caixa | Chat interno |
| `/notificacoes` | admin, financeiro | Log de notificações enviadas |
| `/suporte` | admin, financeiro, caixa | Lista de tickets |
| `/suporte/[id]` | admin, financeiro, caixa | Detalhe do ticket |
| `/suporte/novo` | admin, financeiro, caixa | Abrir ticket |
| `/usuarios` | admin | Lista de operadores |
| `/usuarios/novo` | admin | Criar operador |
| `/usuarios/[id]/editar` | admin | Editar operador |
| `/configuracoes` | admin | Parâmetros + integrações + templates de e-mail |
| `/auditoria` | admin | Log de auditoria com filtros |
| `/portal` | cliente | Home do portal: contratos + progresso |
| `/portal/contratos/[id]` | cliente | Detalhe do contrato + parcelas |
| `/portal/pagamentos` | cliente | Histórico de pagamentos |
| `/portal/pagamentos/pix/[installmentId]` | cliente | Tela PIX: QR Code + copia-e-cola |
| `/portal/suporte` | cliente | Lista de chamados |
| `/portal/suporte/novo` | cliente | Abrir chamado |
| `/portal/suporte/[id]` | cliente | Detalhe do chamado |
| `/portal/perfil` | cliente | Senha + 2FA + preferências de notificação |

---

*Última atualização: 2026-05-23 | Mantido por: equipe SIAFI*
