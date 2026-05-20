# SIAFI 2.0 — Sistema Integrado de Apoio Financeiro
## Contexto para Claude Code (Sessão Persistente)

> **Este arquivo é lido automaticamente em toda sessão. Contém o contexto completo do sistema 2.0.**

---

## Identidade do Sistema

| Campo | Valor |
|-------|-------|
| **Nome** | SIAFI — Sistema Integrado de Apoio Financeiro |
| **Versão** | 2.0 (NestJS + Next.js) |
| **URL Produção** | https://financeiro.lidera.app.br |
| **Empresa** | Lidera |
| **Email** | lideraabrange@gmail.com |
| **Servidor** | Windows Server 2022 + Nginx 1.28.0 |
| **Sistema Legado** | D:\LIDERA\FINANCEIRO\ (PHP 8+, em manutenção) |

---

## Stack Tecnológico (SIAFI 2.0)

```
Backend:   NestJS 10 · TypeScript 5 · Prisma 5 · PostgreSQL via Supabase (sa-east-1)
Frontend:  Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui
Auth:      JWT manual → migrando para Supabase Auth (GoTrue)  [EM MIGRAÇÃO]
Portas:    Backend :4010  Frontend :4011
Deploy:    NSSM (Windows Service) · Nginx reverse proxy · SSL Let's Encrypt
Supabase:  lvpseuaybpnmrneuyndi · https://lvpseuaybpnmrneuyndi.supabase.co
```

---

## Estrutura de Diretórios

```
D:\LIDERA\SIAFI\
├── CLAUDE.md               ← Este arquivo
├── README.md               ← Documentação principal
├── docs/
│   ├── 01_ARQUITETURA.md   ← Decisões de arquitetura
│   ├── 02_BACKEND.md       ← Guia backend completo
│   ├── 03_FRONTEND.md      ← Guia frontend completo
│   ├── 04_DATABASE.md      ← Schema e banco de dados
│   ├── 05_MANUAL_USUARIO.md← Manual do usuário operador
│   └── 06_APRESENTACAO.md  ← Apresentação executiva do sistema
├── backend/                ← NestJS :4010
│   ├── src/modules/        ← 16 módulos funcionais
│   ├── prisma/schema.prisma← Schema siafi_v2
│   └── .env                ← Variáveis de ambiente (não commitar!)
└── frontend/               ← Next.js :4011
    └── src/
        ├── app/(auth)/     ← Login
        ├── app/(dashboard)/← 25 páginas protegidas
        ├── components/ui/  ← button, input, card, badge, skeleton, select, textarea
        └── lib/            ← api.ts, utils.ts
```

---

## Módulos do Backend (16 total)

| Módulo | Endpoint base | Roles | Endpoints principais |
|--------|--------------|-------|---------------------|
| auth | /api/auth | público | POST /login, /refresh, /logout · GET /me |
| users | /api/users | admin | GET / · POST / · PATCH /:id · DELETE /:id |
| clients | /api/clients | admin,financeiro,caixa | GET /,/stats,/quitados,/:id · POST / · PATCH /:id · DELETE /:id |
| loans | /api/loans | admin,financeiro | GET /,/stats,/:id · POST / · PATCH /:id/cancel |
| installments | /api/installments | admin,financeiro,caixa | GET /overdue,/:id · POST /mark-overdue |
| payments | /api/payments | admin,financeiro,caixa | GET / · POST / · DELETE /:id/estornar |
| transactions | /api/transactions | admin,financeiro,caixa | GET /,/saldo,/movimento · POST / |
| renegociacoes | /api/renegociacoes | admin,financeiro | GET /?loanId= · POST / |
| pix | /api/pix | admin,financeiro | GET /:installmentId · POST /generate |
| webhook | /api/webhook/mp | público | POST / |
| notifications | /api/notifications | admin,financeiro | GET / |
| cron | — | sistema | markOverdue(8h) · sendReminders(9h) · sendOverdue(10h) |
| reports | /api/reports | admin,financeiro | GET /carteira,/clientes,/movimentacao,/contratos |
| audit | /api/audit | admin | GET / |
| settings | /api/settings | admin | GET / · PATCH / |
| client-portal | /api/portal | cliente | GET /me,/loans,/installments · POST /tickets |

---

## Endpoints Importantes — Clientes

```
GET  /api/clients/stats     → { total, ativos, inativos, quitados, atrasados }
GET  /api/clients/quitados  → [{ id, nome, cpf }] — clientes com empréstimo quitado
GET  /api/clients           → paginado com search/status
GET  /api/clients/:id       → detalhe com loans[]
POST /api/clients           → criar (multipart: foto, rg, comprovante)
PATCH /api/clients/:id      → atualizar
DELETE /api/clients/:id     → soft-delete (active: false)
```

## Endpoints Importantes — Empréstimos

```
GET  /api/loans             → paginado (search, status, clientId, page, limit)
GET  /api/loans/stats       → { totalAtivos, totalQuitados, valorEmCarteira, valorRecebidoMes }
GET  /api/loans/:id         → detalhe com installments[] e client
POST /api/loans             → criar com geração automática de parcelas
                              Body: { clientId, valor, valorInvestido?, valorParcela (OU taxaJuros),
                                      numeroParcelas, dataInicio, metodoPagamento?, observacoes? }
PATCH /api/loans/:id/cancel → cancelar (status=cancelado, parcelas→cancelado)
```

## Endpoints Importantes — Relatórios

```
GET /api/reports/carteira   → { valorInvestido, valorTotalParcelado, valorRecebido,
                                  aReceber, totalAtivos, totalAtrasados }
GET /api/reports/clientes   → lista de clientes ativos com próxima parcela
GET /api/reports/movimentacao?startDate=&endDate=  → { transactions, payments, summary }
GET /api/reports/contratos?status=  → lista de contratos filtrada
```

---

## Rotas do Frontend (25 páginas, todas em português)

| Rota | Roles | Descrição |
|------|-------|-----------|
| /dashboard | todos | KPIs clicáveis + listas Atrasados/Quitados |
| /clientes | admin,financeiro,caixa | Lista + busca + paginação |
| /clientes/novo | admin,financeiro | Formulário com endereço |
| /clientes/[id] | admin,financeiro,caixa | Detalhe + contratos sequenciais |
| /clientes/[id]/editar | admin,financeiro | Edição com pré-preenchimento |
| /emprestimos | admin,financeiro | Lista + filtro + soma por status |
| /emprestimos/novo | admin,financeiro | Valor da parcela direta + simulação |
| /emprestimos/[id] | admin,financeiro,caixa | Detalhe + pagamento rápido inline |
| /parcelas | admin,financeiro,caixa | Parcelas em atraso com dias |
| /pagamentos | admin,financeiro,caixa | Histórico + estorno |
| /pagamentos/novo | admin,financeiro,caixa | Seleção cliente→loan→parcela |
| /inadimplentes | admin,financeiro | Carteira inadimplente |
| /caixa | admin,financeiro,caixa | Saldo + transações + lançamento |
| /renegociacoes | admin,financeiro | Lista de renegociações |
| /renegociacoes/nova | admin,financeiro | Formulário renegociação |
| /pix | admin,financeiro | Gerador QR Code PIX |
| /conciliacao | admin,financeiro | Conciliação mensal |
| /relatorios | admin,financeiro | 4 abas: carteira, clientes, movimentação, contratos |
| /notificacoes | admin,financeiro | Log de notificações |
| /suporte | admin,financeiro,caixa | Tickets de suporte |
| /usuarios | admin | CRUD de operadores |
| /usuarios/novo | admin | Criar operador |
| /usuarios/[id]/editar | admin | Editar operador |
| /configuracoes | admin | Parâmetros do sistema |
| /auditoria | admin | Log de auditoria paginado |

---

## Dashboard — Estrutura Atual

**4 cards clicáveis:**
- Clientes Ativos → /clientes
- Empréstimos Ativos → /emprestimos
- Clientes Atrasados → /inadimplentes
- Clientes Quitados (informativo)

**2 listas detalhadas:**
- Clientes Atrasados: nomes + quantidade de parcelas em atraso por cliente
- Clientes Quitados: nomes de clientes com empréstimos quitados

---

## Formulário de Novo Empréstimo — Campos Atuais

```
clientId          ← seleção do cliente
valor             ← valor entregue ao cliente
valorInvestido    ← custo de capital (opcional)
numeroParcelas    ← quantidade de parcelas
valorParcela      ← valor de CADA parcela (entrada direta, sem calcular taxa)
metodoPagamento   ← dinheiro | pix | cartao | transferencia | cheque | mercadopago
dataInicio        ← data da primeira parcela
observacoes       ← texto livre
```
O backend deriva a taxa de juros implícita de `valorParcela` automaticamente.

---

## Serviços Windows (NSSM)

| Serviço | Início | Porta |
|---------|--------|-------|
| SIAFI-API | Automático | 4010 |
| SIAFI-WEB | Automático | 4011 |
| SIAFI-API-DEV | Manual | 4010 |
| SIAFI-WEB-DEV | Manual | 4011 |

```powershell
# Reiniciar produção (após build)
sc.exe stop SIAFI-API; Start-Sleep 2; sc.exe start SIAFI-API
sc.exe stop SIAFI-WEB; Start-Sleep 3; sc.exe start SIAFI-WEB
```

---

## Deploy após Alterações

```powershell
# Backend
sc.exe stop SIAFI-API
cd D:\LIDERA\SIAFI\backend && npm run build
sc.exe start SIAFI-API

# Frontend
sc.exe stop SIAFI-WEB
cd D:\LIDERA\SIAFI\frontend && npm run build
sc.exe start SIAFI-WEB
```

---

## Padrões de Desenvolvimento

### Backend
```typescript
// Controller padrão
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('endpoint')
export class MeuController {
  @Get() @Roles('admin', 'financeiro')
  findAll() { return this.service.findAll() }
}
// Rotas estáticas ANTES de /:id para não conflitar
// Ex: GET /clients/stats antes de GET /clients/:id
```

### Frontend
```typescript
// Página de lista padrão
'use client'
const { data, isLoading } = useQuery({
  queryKey: ['entidade'],
  queryFn: () => api.get('/endpoint').then(r => r.data),
})
// Mutations: useMutation + onSuccess: qc.invalidateQueries(...)
// Formulários: useForm + zodResolver(schema) as any (Zod v4 + react-hook-form)
// Dados monetários: sempre formatCurrency()
// Datas: sempre formatDate() ou formatDateTime()
```

### Convenções Obrigatórias
- Rotas sempre em **português** (`/clientes`, `/emprestimos`, `/pagamentos`)
- Operações destrutivas: `confirm()` antes de executar
- Validação Zod v4: usar `zodResolver(schema) as any` (incompatibilidade de tipos)
- Sem comentários no código exceto WHY não-óbvio

---

## Estado Atual (Maio 2026)

### ✅ Implementado e Funcionando
- Autenticação JWT (login/refresh/logout/me)
- CRUD Clientes (com upload foto/RG/comprovante)
- Empréstimos com valorParcela direto (sem taxa de juros manual)
- Parcelas geradas automaticamente
- Pagamentos com estorno
- Caixa (transações manuais)
- Carteira inadimplente
- Renegociação de dívidas
- PIX / Mercado Pago
- Relatórios: Carteira (Valor Investido/Total Parcelado/Recebido/A Receber)
- Conciliação bancária
- Auditoria de ações
- Gestão de Usuários com roles
- Dashboard com Clientes Atrasados e Quitados
- Endpoint /clients/quitados
- Stats ampliados (/clients/stats inclui quitados e atrasados)

### ⚠️ Configurar em Produção
- `MP_ACCESS_TOKEN` — Mercado Pago real
- `WHATSAPP_API_URL` + `WHATSAPP_API_KEY` + `WHATSAPP_INSTANCE` — Evolution API
- SMTP — `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`

### 🔮 Próximas Implementações
- Portal do Cliente frontend (`/minha-conta`)
- Cálculo de multa/mora por atraso (InterestConfig)
- Geração de contratos em PDF
- Dashboard com gráficos (recharts)
- Exportação de relatórios Excel/PDF

---

*Última atualização: 2026-05-19 | Mantido por: Claude Code + equipe Lidera*
