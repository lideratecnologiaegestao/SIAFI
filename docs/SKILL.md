---
name: siafi-roles-consultor
description: Use esta skill sempre que o projeto SIAFI precisar implementar ou revisar o sistema de roles, permissões RBAC ou o módulo do Consultor. Cobre as 5 roles do sistema (admin, financeiro, consultor, caixa, cliente), o vínculo consultor-cliente, intenções de empréstimo, solicitações ao financeiro, cobranças da carteira e o painel exclusivo do consultor. Acione esta skill quando o usuário mencionar: roles, permissões, consultor, carteira de clientes, intenção de empréstimo, solicitação de desconto, reparcelamento, painel do consultor, RBAC, RolesGuard, ou qualquer funcionalidade ligada ao controle de acesso do SIAFI.
---

## Roles do sistema SIAFI (versão atual)

A role `usuario` foi REMOVIDA. O sistema possui exatamente 5 roles:

| Role       | Descrição resumida                                              |
|------------|------------------------------------------------------------------|
| admin      | Acesso total. Único que gerencia usuários e configurações.      |
| financeiro | Operação completa + aprovação de solicitações do consultor.     |
| consultor  | Carteira própria de clientes. Cadastra, cobra, solicita.        |
| caixa      | Registra pagamentos e lançamentos. Leitura de clientes.         |
| cliente    | Acesso exclusivo ao Portal do Cliente (/portal/*).              |

```prisma
enum UserRole {
  admin
  financeiro
  consultor
  caixa
  cliente
}
```

---

## Vínculo Consultor → Cliente

Cada cliente pode ter um consultor responsável:
```prisma
// Em model Client:
consultorId   Int?  @map("consultor_id")
consultor     User? @relation("ClienteConsultor", fields: [consultorId], references: [id])

// Em model User:
clientesCarteira Client[] @relation("ClienteConsultor")
```

**Regras de isolamento da carteira:**
- Consultor vê APENAS clientes onde `client.consultorId = user.id`
- Consultor NÃO pode alterar o `consultorId` de um cliente existente
- Ao cadastrar cliente, `consultorId` é preenchido automaticamente com `user.id`
- Admin e financeiro visualizam todos os clientes independente do consultor

---

## Models novos obrigatórios

### ConsultorSolicitacao
Solicitações formais do consultor ao financeiro:
- Tipos: `desconto` | `reparcelamento` | `intencao_emprestimo` | `outro`
- Status: `pendente` | `aprovado` | `rejeitado`
- Campos: consultorId, clientId, loanId?, tipo, descricao, valorSolicitado?,
  status, respostaFinanceiro?, respondidoPor?, respondidoEm?

### IntencaoEmprestimo
Pedido de empréstimo antes da aprovação formal:
- Status: `aguardando` | `aprovado` | `rejeitado` | `convertido`
- Quando aprovado e convertido em Loan: preencher `loanId`
- Campos: clientId, consultorId, valorSolicitado, numeroParcelas,
  finalidade?, status, aprovadoPor?, aprovadoEm?, loanId?

### CobrancaContato
Histórico de tentativas de contato para cobrança:
- Canal: `whatsapp` | `ligacao` | `presencial`
- Resultado: `prometeu_pagar` | `nao_atendeu` | `numero_incorreto` | `outro`
- Campos: installmentId, clientId, consultorId, canal, resultado,
  prometeuPagarEm?, observacao?

---

## Endpoints do ConsultorModule

```
GET    /api/consultor/dashboard                       → KPIs da carteira
GET    /api/consultor/carteira                        → clientes do consultor
GET    /api/consultor/carteira/:clientId              → detalhe (validar ownership)
POST   /api/clients                                   → criar cliente (consultorId auto)
POST   /api/consultor/intencoes                       → nova intenção
GET    /api/consultor/intencoes                       → listar intenções do consultor
GET    /api/consultor/intencoes/:id                   → detalhe
POST   /api/consultor/solicitacoes                    → nova solicitação
GET    /api/consultor/solicitacoes                    → listar solicitações
GET    /api/consultor/cobrancas                       → parcelas atrasadas da carteira
POST   /api/consultor/cobrancas/:installmentId/contato → registrar contato
POST   /api/consultor/cobrancas/:installmentId/whatsapp → enviar cobrança WA
```

## Endpoints do Financeiro (aprovação)

```
GET    /api/intencoes                   → todas pendentes
PATCH  /api/intencoes/:id/aprovar       → aprovar + opcional loanId
PATCH  /api/intencoes/:id/rejeitar      → rejeitar com justificativa
GET    /api/solicitacoes                → todas pendentes
PATCH  /api/solicitacoes/:id/aprovar    → aprovar com resposta
PATCH  /api/solicitacoes/:id/rejeitar   → rejeitar com justificativa
```

---

## Matriz de permissões resumida

| Recurso                | admin | financeiro | consultor    | caixa  |
|------------------------|-------|------------|--------------|--------|
| Dashboard geral        | ✅    | ✅         | ✅ carteira  | ✅     |
| Clientes (todos)       | ✅    | ✅         | ❌           | 👁️ ler |
| Clientes (carteira)    | ✅    | ✅         | ✅           | ❌     |
| Cadastrar cliente      | ✅    | ✅         | ✅           | ❌     |
| Criar empréstimo       | ✅    | ✅         | ❌           | ❌     |
| Intenção de empréstimo | ✅    | ✅ aprovar | ✅ criar     | ❌     |
| Solicitações           | ✅    | ✅ aprovar | ✅ criar     | ❌     |
| Pagamentos             | ✅    | ✅         | ❌           | ✅     |
| Gerar PIX/boleto       | ✅    | ✅         | ✅ carteira  | ❌     |
| Cobrança WhatsApp      | ✅    | ✅         | ✅ carteira  | ❌     |
| Caixa                  | ✅    | ✅         | ❌           | ✅     |
| Renegociações          | ✅    | ✅         | ❌ (solicita)| ❌     |
| Relatórios             | ✅    | ✅         | ✅ carteira  | ❌     |
| Usuários               | ✅    | ❌         | ❌           | ❌     |
| Configurações          | ✅    | ❌         | ❌           | ❌     |
| Auditoria              | ✅    | ❌         | ❌           | ❌     |

---

## MFA por role

| Role       | Comportamento                                    |
|------------|--------------------------------------------------|
| admin      | Obrigatório imediato — sem prazo                 |
| financeiro | Obrigatório imediato — sem prazo                 |
| consultor  | Obrigatório imediato — sem prazo                 |
| caixa      | Prazo de 5 logins para configurar                |
| cliente    | Prazo de 5 logins para configurar                |

---

## Padrão de proteção nos controllers

```typescript
// ConsultorService — filtro obrigatório em TODA query
async getCarteira(consultorId: number) {
  return this.prisma.client.findMany({
    where: {
      consultorId,  // NUNCA omitir este filtro
      active: true,
    }
  });
}

// Validação de ownership em detalhe do cliente
async getClienteDetalhe(clientId: number, consultorId: number) {
  const client = await this.prisma.client.findFirst({
    where: { id: clientId, consultorId }
  });
  if (!client) throw new ForbiddenException('Cliente não pertence à sua carteira.');
  return client;
}

// Forçar consultorId ao criar cliente
async criarCliente(dto: CreateClientDto, user: User) {
  if (user.role === 'consultor') {
    dto.consultorId = user.id; // forçado — não aceitar do body
  }
  return this.prisma.client.create({ data: dto });
}
```

---

## Rotas Next.js do painel do consultor

```
src/app/(dashboard)/consultor/
├── page.tsx                    ← dashboard KPIs
├── minha-carteira/
│   ├── page.tsx                ← lista de clientes
│   └── [clientId]/page.tsx     ← detalhe + contratos
├── clientes/
│   └── novo/page.tsx           ← cadastrar cliente
├── intencoes/
│   ├── page.tsx                ← lista
│   ├── nova/page.tsx           ← criar
│   └── [id]/page.tsx           ← detalhe
├── solicitacoes/
│   ├── page.tsx                ← lista
│   └── nova/page.tsx           ← criar
└── cobrancas/
    └── page.tsx                ← parcelas atrasadas da carteira
```

---

## Regras invioláveis

- Todo endpoint do ConsultorModule filtra por `consultorId` do JWT
- Consultor NUNCA vê dados fora de sua carteira
- Consultor NUNCA cria empréstimos diretamente — apenas intenções
- Consultor NUNCA renegocia diretamente — envia solicitação ao financeiro
- AuditLog em toda criação de intenção, solicitação e contato de cobrança
- Notificar financeiro/admin via Supabase Realtime ao criar solicitação
