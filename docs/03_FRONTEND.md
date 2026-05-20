# SIAFI 2.0 — Guia do Frontend (Next.js)

## Estrutura de Diretórios

```
frontend/src/
├── app/
│   ├── layout.tsx                  ← Root layout (providers)
│   ├── page.tsx                    ← Redirect → /dashboard
│   ├── (auth)/
│   │   ├── login/page.tsx          ← Página de login (suporta MFA)
│   │   ├── mfa-challenge/page.tsx  ← Verificação de código TOTP
│   │   └── mfa-setup/page.tsx      ← Configuração inicial de MFA
│   ├── auth/
│   │   └── callback/route.ts       ← Route Handler OAuth Google callback
│   └── (dashboard)/
│       ├── layout.tsx              ← Layout com sidebar + topbar + route-role guard
│       ├── dashboard/page.tsx      ← KPIs + Realtime + Clientes Atrasados/Quitados
│       ├── clientes/
│       │   ├── page.tsx            ← Lista com busca e paginação
│       │   ├── novo/page.tsx       ← Formulário com CPF/CNPJ mask + upload docs
│       │   └── [id]/
│       │       ├── page.tsx        ← Detalhe + contratos + card Documentos (URLs assinadas)
│       │       └── editar/page.tsx ← Edição com pré-preenchimento + CPF/CNPJ mask
│       ├── emprestimos/
│       │   ├── page.tsx
│       │   ├── novo/page.tsx
│       │   └── [id]/page.tsx
│       ├── parcelas/page.tsx
│       ├── pagamentos/
│       │   ├── page.tsx
│       │   └── novo/page.tsx
│       ├── inadimplentes/page.tsx
│       ├── caixa/page.tsx
│       ├── renegociacoes/
│       │   ├── page.tsx
│       │   └── nova/page.tsx
│       ├── pix/page.tsx
│       ├── conciliacao/page.tsx
│       ├── relatorios/page.tsx
│       ├── notificacoes/page.tsx
│       ├── suporte/page.tsx
│       ├── usuarios/
│       │   ├── page.tsx
│       │   ├── novo/page.tsx
│       │   └── [id]/editar/page.tsx
│       ├── configuracoes/page.tsx
│       └── auditoria/page.tsx
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx             ← Menu lateral com roles
│   │   └── topbar.tsx              ← Barra superior
│   └── ui/
│       ├── button.tsx · card.tsx · input.tsx · label.tsx
│       ├── badge.tsx · skeleton.tsx
│       ├── select.tsx              ← select nativo estilizado
│       └── textarea.tsx
├── contexts/
│   └── auth.context.tsx            ← AccessToken em memória (Supabase JWT)
└── lib/
    ├── api.ts                      ← Axios + refresh automático (Supabase)
    ├── supabase/
    │   └── mfa.ts                  ← Helpers de API diretos para MFA (challenge/verify)
    └── utils.ts                    ← Formatação + constantes
```

---

## Autenticação no Frontend

### AuthContext

```typescript
const AuthContext = {
  user: { id: number; nome: string; role: UserRole } | null,
  accessToken: string | null,    // JWT Supabase em memória
  isAuthenticated: boolean,
  isLoading: boolean,
  login(username, password): Promise<{ needsMfa?: boolean }>,
  completeMfa(factorId, code): Promise<void>,  // eleva AAL para aal2
  logout(): Promise<void>,
}

type UserRole = 'admin' | 'financeiro' | 'caixa' | 'usuario' | 'cliente'
```

### Refresh Automático de Token

Em `lib/api.ts`, o interceptor de response:
1. Detecta 401
2. Faz `POST /api/auth/refresh` (cookie httpOnly Supabase enviado automaticamente)
3. Supabase emite novo access_token via `refreshSession()`
4. Atualiza accessToken em memória
5. Re-tenta a requisição original
6. Fila de requisições concorrentes para evitar múltiplos refreshes simultâneos

---

## Route-Role Guard (Dashboard Layout)

O layout `(dashboard)/layout.tsx` protege rotas por role no cliente:

```typescript
const ROUTE_ROLES: Array<{ prefix: string; roles: UserRole[] }> = [
  { prefix: '/usuarios',     roles: ['admin'] },
  { prefix: '/configuracoes',roles: ['admin'] },
  { prefix: '/auditoria',    roles: ['admin'] },
  { prefix: '/emprestimos',  roles: ['admin', 'financeiro'] },
  { prefix: '/relatorios',   roles: ['admin', 'financeiro'] },
  { prefix: '/renegociacoes',roles: ['admin', 'financeiro'] },
  { prefix: '/pix',          roles: ['admin', 'financeiro'] },
  { prefix: '/conciliacao',  roles: ['admin', 'financeiro'] },
  { prefix: '/inadimplentes',roles: ['admin', 'financeiro'] },
  { prefix: '/notificacoes', roles: ['admin', 'financeiro'] },
]
```

Rotas não listadas são acessíveis por todos os roles autenticados.
Redirecionamento para `/dashboard` se o role não tem permissão.

> **Importante:** `usePathname()` retorna `null` durante a hidratação Next.js.
> O guard usa `pathname &&` antes de chamar `isAllowed()` para evitar crash.

---

## CPF/CNPJ Mask — Padrão Controller

Campos CPF/CNPJ usam `Controller` do react-hook-form (não `register`) para máscara ao vivo:

```typescript
function formatCpfCnpj(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

// No JSX:
<Controller
  name="cpf"
  control={control}
  render={({ field }) => (
    <Input
      value={formatCpfCnpj(field.value ?? '')}
      onChange={(e) => field.onChange(formatCpfCnpj(e.target.value))}
      onBlur={field.onBlur}
      placeholder="000.000.000-00 ou 00.000.000/0000-00"
      maxLength={18}
    />
  )}
/>
```

A máscara alterna automaticamente entre formato CPF (≤11 dígitos) e CNPJ (12–14 dígitos).

---

## Formulário com Validação — Padrão

```typescript
const schema = z.object({
  nome: z.string().min(3),
  valor: z.coerce.number().min(0.01),
})
type FormData = z.infer<typeof schema>

const { register, handleSubmit, control, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema) as any,  // "as any" — Zod v4 incompatível com react-hook-form types
})

const mutation = useMutation({
  mutationFn: (data: FormData) => api.post('/entidades', data),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['entidades'] })
    router.push('/entidades')
  },
})
```

### FormData com Uploads (multipart)

```typescript
mutationFn: (data: FormData) => {
  const fd = new window.FormData()
  // Pular campos vazios — @IsOptional() não aceita string vazia no backend
  Object.entries(data).forEach(([k, v]) => {
    if (v !== undefined && v !== '') fd.append(k, String(v))
  })
  if (foto) fd.append('foto', foto)
  return api.post('/clients', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
```

> **Atenção:** Campos opcionais (`dataNascimento`, `email`, `estado`) devem ser omitidos
> do FormData quando vazios. O backend rejeita `""` com erro de validação.

---

## Padrão de Página de Lista

```typescript
'use client'

export default function EntidadesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['entidades', { search, page }],
    queryFn: () => api.get('/entidades', {
      params: { search: search || undefined, page, limit: 20 }
    }).then(r => r.data),
  })
  // data = { data: [], total: N, page: N, lastPage: N }
}
```

---

## Dashboard — Realtime

O dashboard usa `useRealtimeDashboard()` para receber atualizações ao vivo:

```typescript
// Hook subscreve Supabase Realtime em installments, payments, transactions
// Ao receber evento → invalida queries ['clients', 'stats'] e ['loans', 'stats']
// Indicador visual: ponto verde pulsante no canto do dashboard
```

---

## Utilitários (lib/utils.ts)

```typescript
formatCurrency(value)       // R$ 1.234,56
formatDate(date)            // 19/05/2026
formatDateTime(date)        // 19/05/2026, 14:30
formatCPF(cpf)              // 000.000.000-00
formatPhone(phone)          // (00) 00000-0000
formatCEP(cep)              // 00000-000

STATUS_LOAN         → { ativo, quitado, inadimplente, cancelado }
STATUS_INSTALLMENT  → { pendente, pago, atrasado, cancelado }
METODO_PAGAMENTO    → { dinheiro, pix, cartao, transferencia, cheque, mercadopago }
```

---

## Sidebar — Grupos de Menu e Roles

| Grupo | Itens | Roles mínimos |
|-------|-------|---------------|
| Principal | Dashboard | todos |
| Operacional | Clientes, Empréstimos, Parcelas, Pagamentos, Inadimplentes | caixa+ |
| Financeiro | Caixa, Renegociações, Conciliação, PIX | financeiro+ |
| Relatórios | Relatórios | financeiro+ |
| Comunicação | Notificações, Suporte | caixa+ |
| Administração | Usuários, Configurações, Auditoria | admin |

---

## Dashboard — Estrutura Atual

**Linha 1 — 4 cards stat (clicáveis):**

| Card | Dado | Link |
|------|------|------|
| Clientes Ativos | `clientsStats.ativos` | /clientes |
| Empréstimos Ativos | `loansStats.totalAtivos` | /emprestimos |
| Clientes Atrasados | `clientsStats.atrasados` | /inadimplentes |
| Clientes Quitados | `clientsStats.quitados` | — |

**Nota:** `loansStats` só é buscado se `user.role === 'admin' || 'financeiro'`.
O role `caixa` vê apenas os cards de clientes.

**Linha 2 — 2 cards de lista:**
- **Clientes Atrasados**: nomes + badge com qtde de parcelas por cliente (de `/installments/overdue`)
- **Clientes Quitados**: nomes de clientes de `/clients/quitados`

---

## Componentes UI Disponíveis

```typescript
<Button variant="default|outline|ghost|destructive" size="sm|default|lg" />
<Card> <CardHeader> <CardTitle> <CardContent> </Card>
<Input type="text|number|date|password" />
<Select {...register('campo')}> <option value="x">X</option> </Select>
<Textarea rows={3} />
<Badge variant="default|success|warning|destructive|outline" />
<Skeleton className="h-8 w-full" />
<Label>Texto</Label>
```

---

## Build e Verificação

```powershell
cd D:\LIDERA\SIAFI\frontend

npm run build          # build de produção (lista páginas geradas)
npx tsc --noEmit       # checar tipos sem buildar
npm run lint           # linting
```

---

*Última atualização: 2026-05-20*
