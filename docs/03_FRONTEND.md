# SIAFI 2.0 — Guia do Frontend (Next.js)

## Estrutura de Diretórios

```
frontend/src/
├── app/
│   ├── layout.tsx                  ← Root layout (providers)
│   ├── (auth)/
│   │   └── login/page.tsx          ← Página de login
│   └── (dashboard)/
│       ├── layout.tsx              ← Layout com sidebar + topbar
│       ├── dashboard/page.tsx      ← KPIs + Clientes Atrasados/Quitados
│       ├── clientes/
│       │   ├── page.tsx            ← Lista com busca e paginação
│       │   ├── novo/page.tsx       ← Formulário de criação
│       │   └── [id]/
│       │       ├── page.tsx        ← Detalhe + contratos sequenciais
│       │       └── editar/page.tsx ← Edição com pré-preenchimento
│       ├── emprestimos/
│       │   ├── page.tsx            ← Lista + filtro + soma por status
│       │   ├── novo/page.tsx       ← Valor parcela direta + simulação
│       │   └── [id]/page.tsx       ← Detalhe + pagamento rápido inline
│       ├── parcelas/page.tsx       ← Parcelas em atraso
│       ├── pagamentos/
│       │   ├── page.tsx            ← Histórico + estorno
│       │   └── novo/page.tsx       ← Seleção cliente→loan→parcela
│       ├── inadimplentes/page.tsx  ← Carteira inadimplente
│       ├── caixa/page.tsx          ← Saldo + transações + lançamento
│       ├── renegociacoes/
│       │   ├── page.tsx            ← Lista de renegociações
│       │   └── nova/page.tsx       ← Formulário
│       ├── pix/page.tsx            ← QR Code PIX
│       ├── conciliacao/page.tsx    ← Conciliação mensal
│       ├── relatorios/page.tsx     ← 4 abas gerenciais
│       ├── notificacoes/page.tsx   ← Log de notificações
│       ├── suporte/page.tsx        ← Tickets
│       ├── usuarios/
│       │   ├── page.tsx            ← CRUD operadores
│       │   ├── novo/page.tsx
│       │   └── [id]/editar/page.tsx
│       ├── configuracoes/page.tsx  ← Parâmetros
│       └── auditoria/page.tsx      ← Log de auditoria
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
│   └── auth.context.tsx            ← AccessToken em memória
└── lib/
    ├── api.ts                      ← Axios + refresh automático
    └── utils.ts                    ← Formatação + constantes
```

---

## Autenticação no Frontend

### AuthContext

```typescript
const AuthContext = {
  user: { id, nome, username, role } | null,
  accessToken: string | null,    // em memória — não no localStorage
  login(username, password),
  logout(),
  isLoading: boolean,
}
```

### Refresh Automático de Token

Em `lib/api.ts`, o interceptor de response:
1. Detecta 401
2. Faz `POST /auth/refresh` (cookie httpOnly enviado automaticamente)
3. Atualiza accessToken em memória
4. Re-tenta a requisição original
5. Fila de requisições concorrentes para evitar múltiplos refreshes simultâneos

---

## Padrão de Página de Lista

```typescript
'use client'

export default function EntidadesPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['entidades', { search, page }],
    queryFn: () => api.get('/entidades', {
      params: { search: search || undefined, page, limit: 20 }
    }).then(r => r.data),
  })
  // data = { data: [], total: N, page: N, lastPage: N }
}
```

---

## Padrão de Formulário com Validação

```typescript
const schema = z.object({
  nome: z.string().min(3),
  valor: z.coerce.number().min(0.01),
})
type FormData = z.infer<typeof schema>

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
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

**Linha 2 — 2 cards de lista:**
- **Clientes Atrasados**: nomes + badge com qtde de parcelas por cliente (de `/installments/overdue`)
- **Clientes Quitados**: nomes de clientes de `/clients/quitados`

---

## Formulário Novo Empréstimo — Campos

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Cliente | select | ✅ |
| Valor do Empréstimo | number | ✅ |
| Valor Investido | number | — |
| Número de Parcelas | number | ✅ |
| Valor da Parcela | number | ✅ |
| Forma de Pagamento | select | ✅ |
| Data de Início | date | ✅ |
| Observações | textarea | — |

Simulação ao vivo: Capital · Parcelas × Valor · Total a Pagar · Total de Acréscimo

---

## Relatórios — Aba Carteira

| # | Label | Campo Backend | Cor |
|---|-------|--------------|-----|
| 1 | Valor Investido | `valorInvestido` | neutro |
| 2 | Valor Total Parcelado | `valorTotalParcelado` | azul |
| 3 | Valor Recebido | `valorRecebido` | verde |
| 4 | A Receber | `aReceber` | laranja |

Indicadores extras: Empréstimos Ativos (verde) · Empréstimos em Atraso (vermelho)
Tabela de Contratos: rodapé com soma de valores.

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

*Última atualização: 2026-05-19*
