# SIAFI 2.0 — Refatoração de Arquitetura: Split de Parcela e Consolidação Supabase
# Prompt de Engenharia Sênior — Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos:
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md

---

```
Você é um Engenheiro de Software Sênior e Arquiteto de Sistemas com
expertise em sistemas financeiros, NestJS, Prisma e Supabase. Analise
a documentação completa do SIAFI 2.0 antes de escrever qualquer código.

O SIAFI é o sistema financeiro da Lidera Tecnologia — uma empresa de
factoring e empréstimos. Precisamos realizar duas evoluções críticas e
interdependentes: a introdução da lógica de Split de Parcela (separação
entre recuperação de capital e faturamento real) e a consolidação de
todos os pontos de integração com o Supabase que ainda não foram
migrados.

Leia todos os documentos antes de responder. Pergunte se houver
ambiguidade antes de implementar. Entregue um grupo por vez e aguarde
confirmação para avançar.

═══════════════════════════════════════════════════════════════════
CONTEXTO — O QUE EXISTE HOJE
═══════════════════════════════════════════════════════════════════

Estado atual do schema relevante:

model Loan {
  valor          Decimal   // capital entregue ao cliente
  valorInvestido Decimal?  // usado de forma inconsistente — às vezes
                           // representa o custo de capital, às vezes
                           // o lucro desejado
  taxaJuros      Decimal   // taxa implícita — não decomposta por parcela
  numeroParcelas Int
}

model Installment {
  valor    Decimal   // valor total da parcela — caixa preta
  totalPago Decimal  // quanto foi recebido
  // Problema: não há como saber quanto de cada parcela paga
  // é recuperação do capital emprestado e quanto é lucro (faturamento)
}

O problema de negócio: o operador da Lidera não consegue responder
"quanto eu realmente lucrei este mês?" porque o sistema mistura
capital recuperado com faturamento em um único campo `valor`.

═══════════════════════════════════════════════════════════════════
PARTE 1 — NOVA NOMENCLATURA E MODELO FINANCEIRO
═══════════════════════════════════════════════════════════════════

## 1.1 — Glossário de termos (use exatamente estes nomes)

| Termo técnico         | Significado de negócio                              |
|-----------------------|-----------------------------------------------------|
| principal_amount      | Capital entregue ao cliente (sai do caixa)          |
| target_profit         | Lucro total que o operador deseja obter no contrato |
| total_receivable      | principal_amount + target_profit (total a receber)  |
| installment_amount    | Valor total de cada parcela                         |
| principal_payback     | Parcela da prestação que recupera o capital         |
| net_gain              | Parcela da prestação que representa lucro líquido   |

Relação invariável entre os campos:
  total_receivable    = principal_amount + target_profit
  installment_amount  = total_receivable / numero_parcelas
  principal_payback   = principal_amount / numero_parcelas
  net_gain            = target_profit    / numero_parcelas
  installment_amount  = principal_payback + net_gain  ← sempre verdadeiro

## 1.2 — Refatoração do schema Prisma (migration)

Gere a migration com as seguintes alterações:

### model Loan — campos a renomear e adicionar

```prisma
model Loan {
  id              Int        @id @default(autoincrement())
  clientId        Int        @map("client_id")
  consultorId     Int?       @map("consultor_id")   // FK para User (Fase 1)

  // ── Campos financeiros refatorados ──────────────────────────────
  principalAmount Decimal    @db.Decimal(10, 2) @map("principal_amount")
  // Renomeado de: valor
  // Representa: capital que saiu do caixa da Lidera

  targetProfit    Decimal    @db.Decimal(10, 2) @map("target_profit")
  // Renomeado de: valorInvestido
  // Representa: lucro total que o operador definiu para este contrato
  // ATENÇÃO: não é mais opcional — todo contrato DEVE ter um lucro alvo

  totalReceivable Decimal    @db.Decimal(10, 2) @map("total_receivable")
  // Novo campo: calculado = principalAmount + targetProfit
  // Armazenado para evitar recálculo e garantir integridade auditável

  numeroParcelas  Int        @map("numero_parcelas")
  dataInicio      DateTime   @map("data_inicio")
  status          LoanStatus @default(ativo)
  metodoPagamento PaymentMethod @default(dinheiro) @map("metodo_pagamento")
  observacoes     String?    @db.Text

  // ── Campos removidos ─────────────────────────────────────────────
  // taxaJuros e modoTaxa são REMOVIDOS do model Loan.
  // O sistema não trabalha mais com taxa percentual — o operador
  // define o lucro absoluto (target_profit), não uma taxa.
  // Manter para leitura por compatibilidade mas marcar @deprecated:
  taxaJuros       Decimal?   @db.Decimal(5, 2) @map("taxa_juros")
  // @deprecated — manter apenas para dados históricos. Não usar em novos registros.

  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  client        Client         @relation(fields: [clientId], references: [id])
  consultor     User?          @relation("LoanConsultor", fields: [consultorId], references: [id])
  installments  Installment[]
  renegociacoes Renegociacao[]
  mpPayments    MpPayment[]
  notifications Notification[]

  @@index([clientId])
  @@index([consultorId])
  @@index([status])
  @@map("loans")
}
```

### model Installment — campos a adicionar

```prisma
model Installment {
  id              Int               @id @default(autoincrement())
  loanId          Int               @map("loan_id")
  numero          Int

  // ── Campos financeiros com Split ─────────────────────────────────
  installmentAmount Decimal         @db.Decimal(10, 2) @map("installment_amount")
  // Renomeado de: valor
  // Representa: valor total que o cliente deve pagar nesta parcela

  principalPayback  Decimal         @db.Decimal(10, 2) @map("principal_payback")
  // Novo: quanto desta parcela recupera o capital emprestado
  // Calculado na criação: principalAmount / numeroParcelas
  // Na última parcela: recebe o ajuste de centavos do principal

  netGain           Decimal         @db.Decimal(10, 2) @map("net_gain")
  // Novo: quanto desta parcela é faturamento/lucro líquido da Lidera
  // Calculado na criação: targetProfit / numeroParcelas
  // Na última parcela: recebe o ajuste de centavos do lucro

  // ── Invariante que DEVE ser verificada ao gerar: ─────────────────
  // installmentAmount === principalPayback + netGain

  dataVencimento  DateTime          @map("data_vencimento")
  status          InstallmentStatus @default(pendente)
  totalPago       Decimal           @default(0) @db.Decimal(10, 2) @map("total_pago")
  createdAt       DateTime          @default(now()) @map("created_at")
  updatedAt       DateTime          @updatedAt @map("updated_at")

  loan        Loan         @relation(fields: [loanId], references: [id])
  payments    Payment[]
  pixPayments PixPayment[]
  mpPayments  MpPayment[]

  @@index([loanId])
  @@index([status])
  @@index([dataVencimento])
  @@map("installments")
}
```

### Campos de compatibilidade retroativa

Para não quebrar dados históricos, a migration deve:
1. Adicionar as colunas novas com valor DEFAULT temporário
2. Executar UPDATE SET para popular os novos campos a partir dos antigos:
   - principal_amount = valor (antigo)
   - target_profit = COALESCE(valor_investido, 0)
   - total_receivable = valor + COALESCE(valor_investido, 0)
3. Para installments existentes: calcular principal_payback e net_gain
   proporcionalmente com base no loan pai
4. Após popular, setar NOT NULL onde aplicável

═══════════════════════════════════════════════════════════════════
PARTE 2 — LÓGICA DE SPLIT DE PARCELA (NestJS — LoansService)
═══════════════════════════════════════════════════════════════════

## 2.1 — DTO de criação de empréstimo

```typescript
// create-loan.dto.ts
export class CreateLoanDto {
  @IsInt() @Min(1)
  clientId: number;

  @IsDecimal() @Min(0.01)
  principalAmount: string;  // Decimal como string para evitar float

  @IsDecimal() @Min(0.01)
  targetProfit: string;     // Lucro total desejado — não mais taxa %

  @IsInt() @Min(1) @Max(360)
  numeroParcelas: number;

  @IsEnum(PaymentMethod)
  metodoPagamento: PaymentMethod;

  @IsDateString()
  dataInicio: string;

  @IsOptional() @IsString()
  observacoes?: string;
}
```

## 2.2 — Algoritmo de geração de parcelas com Split

Implemente em `LoansService.createLoan()` usando a biblioteca `decimal.js`.
Nunca usar `number` nativo para cálculos financeiros.

```typescript
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

async createLoan(dto: CreateLoanDto, operadorId: number): Promise<Loan> {

  const principal   = new Decimal(dto.principalAmount);
  const profit      = new Decimal(dto.targetProfit);
  const n           = dto.numeroParcelas;
  const total       = principal.plus(profit);

  // ── Cálculo base de cada parcela ──────────────────────────────
  // Divisão inteira com arredondamento para baixo (floor)
  // A diferença vai para a última parcela
  const baseInstallment  = total.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const basePrincipal    = principal.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const baseGain         = profit.dividedBy(n).toDecimalPlaces(2, Decimal.ROUND_DOWN);

  // ── Cálculo dos ajustes de centavos (última parcela) ──────────
  // Garante que a soma de todas as parcelas seja EXATAMENTE igual ao total
  const somaInstallments = baseInstallment.times(n);
  const somaPrincipal    = basePrincipal.times(n);
  const somaGain         = baseGain.times(n);

  const ajusteInstallment = total.minus(somaInstallments);       // centavos sobrando
  const ajustePrincipal   = principal.minus(somaPrincipal);      // centavos do principal
  const ajusteGain        = profit.minus(somaGain);              // centavos do lucro

  // ── Verificação de integridade antes de persistir ─────────────
  // ajusteInstallment DEVE ser igual a ajustePrincipal + ajusteGain
  const ajusteCheck = ajustePrincipal.plus(ajusteGain);
  if (!ajusteCheck.equals(ajusteInstallment)) {
    throw new InternalServerErrorException(
      'Erro de integridade no cálculo de split: ajuste de centavos inconsistente.'
    );
  }

  // ── Geração das parcelas ────────────────────────────────────────
  const installments = Array.from({ length: n }, (_, i) => {
    const isUltima      = i === n - 1;
    const installAmt    = isUltima
      ? baseInstallment.plus(ajusteInstallment)
      : baseInstallment;
    const principalPay  = isUltima
      ? basePrincipal.plus(ajustePrincipal)
      : basePrincipal;
    const gain          = isUltima
      ? baseGain.plus(ajusteGain)
      : baseGain;

    // Verificação de invariante por parcela
    if (!installAmt.equals(principalPay.plus(gain))) {
      throw new InternalServerErrorException(
        `Invariante violada na parcela ${i + 1}: ` +
        `${installAmt} !== ${principalPay} + ${gain}`
      );
    }

    return {
      numero:           i + 1,
      installmentAmount: installAmt.toDecimalPlaces(2).toNumber(),
      principalPayback:  principalPay.toDecimalPlaces(2).toNumber(),
      netGain:           gain.toDecimalPlaces(2).toNumber(),
      dataVencimento:    addMonths(new Date(dto.dataInicio), i),
      status:            'pendente' as InstallmentStatus,
      totalPago:         0,
    };
  });

  // ── Persistir em $transaction ────────────────────────────────────
  return this.prisma.$transaction(async (tx) => {
    const loan = await tx.loan.create({
      data: {
        clientId:        dto.clientId,
        consultorId:     operadorId, // se role = consultor
        principalAmount: principal.toDecimalPlaces(2).toNumber(),
        targetProfit:    profit.toDecimalPlaces(2).toNumber(),
        totalReceivable: total.toDecimalPlaces(2).toNumber(),
        numeroParcelas:  n,
        metodoPagamento: dto.metodoPagamento,
        dataInicio:      new Date(dto.dataInicio),
        observacoes:     dto.observacoes,
        taxaJuros:       0, // @deprecated — manter por compatibilidade
      },
    });

    await tx.installment.createMany({
      data: installments.map(inst => ({ ...inst, loanId: loan.id })),
    });

    // AuditLog snapshot — estado inicial do contrato
    await tx.auditLog.create({
      data: {
        userId:     operadorId,
        acao:       'LOAN_CRIADO',
        entidade:   'loans',
        entidadeId: loan.id,
        dados: {
          snapshot: {
            principalAmount:  principal.toString(),
            targetProfit:     profit.toString(),
            totalReceivable:  total.toString(),
            numeroParcelas:   n,
            baseInstallment:  baseInstallment.toString(),
            basePrincipal:    basePrincipal.toString(),
            baseGain:         baseGain.toString(),
            ajusteInstallment: ajusteInstallment.toString(),
          }
        },
      }
    });

    return loan;
  });
}
```

## 2.3 — Validação pós-criação (método utilitário)

Adicione um método que pode ser chamado para verificar integridade
de qualquer contrato existente no banco:

```typescript
async verificarIntegridadeLoan(loanId: number): Promise<{
  integro: boolean;
  divergencias: string[];
}> {
  const loan = await this.prisma.loan.findUnique({
    where: { id: loanId },
    include: { installments: true }
  });

  const divergencias: string[] = [];
  const total = new Decimal(loan.totalReceivable.toString());
  const somaInstallments = loan.installments.reduce(
    (acc, inst) => acc.plus(inst.installmentAmount.toString()),
    new Decimal(0)
  );
  const somaPrincipal = loan.installments.reduce(
    (acc, inst) => acc.plus(inst.principalPayback.toString()),
    new Decimal(0)
  );
  const somaGain = loan.installments.reduce(
    (acc, inst) => acc.plus(inst.netGain.toString()),
    new Decimal(0)
  );

  if (!somaInstallments.equals(total))
    divergencias.push(`Soma parcelas (${somaInstallments}) ≠ totalReceivable (${total})`);
  if (!somaPrincipal.equals(new Decimal(loan.principalAmount.toString())))
    divergencias.push(`Soma principal_payback ≠ principalAmount`);
  if (!somaGain.equals(new Decimal(loan.targetProfit.toString())))
    divergencias.push(`Soma net_gain ≠ targetProfit`);

  return { integro: divergencias.length === 0, divergencias };
}
```

═══════════════════════════════════════════════════════════════════
PARTE 3 — RELATÓRIOS DE FATURAMENTO (ReportsService)
═══════════════════════════════════════════════════════════════════

## 3.1 — Novos endpoints de relatório

```
GET /api/reports/faturamento?mes=2026-05
    → faturamento mensal detalhado

GET /api/reports/carteira
    → atualizar para usar os novos campos
```

## 3.2 — ReportsService.getFaturamentoMensal()

```typescript
async getFaturamentoMensal(mes: string): Promise<FaturamentoMensalDto> {
  // mes no formato 'YYYY-MM'
  const inicio = startOfMonth(new Date(mes + '-01'));
  const fim    = endOfMonth(inicio);

  // Parcelas PAGAS no período
  const parcelasPagas = await this.prisma.installment.findMany({
    where: {
      status: 'pago',
      updatedAt: { gte: inicio, lte: fim },
    },
    select: {
      id:               true,
      installmentAmount: true,
      principalPayback:  true,
      netGain:           true,
      loan: {
        select: {
          clientId:       true,
          principalAmount: true,
          targetProfit:    true,
          consultor: { select: { id: true, nome: true } }
        }
      }
    }
  });

  // Calcular totais com decimal.js — nunca number nativo
  const faturamentoBruto    = parcelasPagas.reduce(
    (acc, p) => acc.plus(p.netGain.toString()), new Decimal(0)
  );
  const recuperacaoCapital  = parcelasPagas.reduce(
    (acc, p) => acc.plus(p.principalPayback.toString()), new Decimal(0)
  );
  const totalRecebido       = parcelasPagas.reduce(
    (acc, p) => acc.plus(p.installmentAmount.toString()), new Decimal(0)
  );

  // Verificação de integridade do relatório
  if (!totalRecebido.equals(faturamentoBruto.plus(recuperacaoCapital))) {
    throw new InternalServerErrorException('Inconsistência nos dados de faturamento.');
  }

  return {
    mes,
    totalRecebido:      totalRecebido.toDecimalPlaces(2).toNumber(),
    faturamentoBruto:   faturamentoBruto.toDecimalPlaces(2).toNumber(),
    recuperacaoCapital: recuperacaoCapital.toDecimalPlaces(2).toNumber(),
    quantidadeParcelas: parcelasPagas.length,
    // Breakdown por consultor (se aplicável)
    porConsultor: agruparPorConsultor(parcelasPagas),
  };
}
```

## 3.3 — Atualizar GET /api/reports/carteira

Atualizar o retorno para incluir os novos campos e remover
nomenclaturas antigas:

```typescript
// Antes:
{
  valorInvestido: ...,      // ← remover
  valorTotalParcelado: ..., // ← renomear
  valorRecebido: ...,
  aReceber: ...,
}

// Depois:
{
  // Capital
  principalEmCarteira:     ..., // soma principalAmount dos loans ativos
  principalRecuperado:     ..., // soma principalPayback das parcelas pagas
  principalARecuperar:     ..., // diferença

  // Faturamento
  targetProfitEmCarteira:  ..., // soma targetProfit dos loans ativos
  faturamentoRealizado:    ..., // soma netGain das parcelas pagas
  faturamentoAReceber:     ..., // diferença

  // Totais operacionais (manter para compatibilidade de dashboard)
  totalReceivableAtivo:    ..., // total_receivable dos loans ativos
  totalRecebido:           ..., // soma installment_amount das parcelas pagas
  aReceber:                ..., // soma installment_amount das parcelas pendentes/atrasadas
  totalAtivos:             ...,
  totalAtrasados:          ...,
}
```

═══════════════════════════════════════════════════════════════════
PARTE 4 — CONSOLIDAÇÃO SUPABASE
═══════════════════════════════════════════════════════════════════

O Supabase Auth, Storage e Realtime já foram implementados nas Fases
1, 2 e 3. Esta parte consolida os pontos que podem ainda não estar
100% alinhados com a nova estrutura de campos.

## 4.1 — RLS: políticas para os novos campos

No Supabase SQL Editor, revisar/criar as políticas de RLS para garantir
que a role `cliente` (acessando via Portal) nunca veja campos internos:

```sql
-- Política para loans: cliente vê apenas seus próprios contratos
-- E NUNCA vê: target_profit, principal_amount, consultor_id
CREATE POLICY "cliente_ver_proprios_loans"
ON loans FOR SELECT
TO authenticated
USING (
  client_id = (
    SELECT id FROM clients
    WHERE supabase_id = auth.uid()
    LIMIT 1
  )
);

-- Política para installments: cliente vê apenas parcelas dos seus loans
-- ATENÇÃO: net_gain e principal_payback são campos INTERNOS
-- O portal deve buscar via backend que filtra os campos retornados
-- NÃO expor net_gain e principal_payback via PostgREST direto
CREATE POLICY "cliente_ver_proprias_installments"
ON installments FOR SELECT
TO authenticated
USING (
  loan_id IN (
    SELECT id FROM loans
    WHERE client_id = (
      SELECT id FROM clients
      WHERE supabase_id = auth.uid()
      LIMIT 1
    )
  )
);
```

ATENÇÃO crítica: os campos `net_gain` e `principal_payback` são dados
financeiros internos da Lidera. Eles nunca devem ser retornados pelos
endpoints do portal (/api/portal/*). O ClientPortalService deve
fazer SELECT explícito excluindo esses campos.

```typescript
// ClientPortalService — CORRETO
const parcelas = await this.prisma.installment.findMany({
  where: { loanId, loan: { clientId } },
  select: {
    id:               true,
    numero:           true,
    installmentAmount: true,  // ✅ exibir — é o que o cliente paga
    dataVencimento:   true,
    status:           true,
    totalPago:        true,
    // principalPayback: NÃO  ← dado interno
    // netGain:          NÃO  ← dado interno
  }
});
```

## 4.2 — Supabase Realtime: adicionar installments ao split

A publication `supabase_realtime` já tem `installments`.
Confirmar que os novos campos `principal_payback` e `net_gain` são
incluídos nos eventos Realtime apenas para operadores — nunca no
canal do portal do cliente.

## 4.3 — Supabase Storage: sem alterações

O bucket `client-documents` e o `SupabaseService` não precisam de
alteração — esta parte é apenas confirmação de status.

═══════════════════════════════════════════════════════════════════
PARTE 5 — FRONTEND: ATUALIZAÇÃO DAS TELAS
═══════════════════════════════════════════════════════════════════

## 5.1 — Formulário de novo empréstimo (/emprestimos/novo)

Substituir os campos atuais pelos novos:

```
ANTES                          DEPOIS
───────────────────────────    ──────────────────────────────────
Valor do Empréstimo         →  Capital (principal_amount)
                               Label: "Valor entregue ao cliente"
Valor Investido             →  Lucro Alvo (target_profit)
                               Label: "Lucro total desejado no contrato"
Valor da Parcela            →  Calculado automaticamente (read-only)
                               Fórmula: (capital + lucro) / parcelas
Taxa de Juros               →  REMOVER — não existe mais no novo modelo
```

Simulação ao vivo atualizada (4 indicadores):

```typescript
// Calcular em tempo real conforme o usuário digita
const capital      = new Decimal(watch('principalAmount') || 0);
const lucroAlvo    = new Decimal(watch('targetProfit') || 0);
const parcelas     = watch('numeroParcelas') || 1;
const totalAReceber = capital.plus(lucroAlvo);
const valorParcela  = totalAReceber.dividedBy(parcelas).toDecimalPlaces(2);

// Exibir:
// Capital desembolsado:    R$ {capital}
// Total a receber:         R$ {totalAReceber}
// Valor de cada parcela:   R$ {valorParcela}
// Lucro alvo total:        R$ {lucroAlvo}
```

## 5.2 — Detalhe do empréstimo (/emprestimos/[id])

Atualizar o resumo financeiro:

```
ANTES                          DEPOIS
───────────────────────────    ──────────────────────────────────
Valor Emprestado            →  Capital Desembolsado
Total a Pagar               →  Total a Receber
Total Pago                  →  Total Recebido
Pendente                    →  A Receber
```

Adicionar nova seção "Split do Contrato" (visível apenas para
admin, financeiro e consultor — nunca para cliente):

```
┌──────────────────────────────────────────────────────┐
│  Split do Contrato                                   │
├──────────────────────────────────────────────────────┤
│  Capital desembolsado     R$ 1.000,00                │
│  Lucro alvo               R$   400,00                │
│  Total a receber          R$ 1.400,00                │
├──────────────────────────────────────────────────────┤
│  Recuperação de capital   R$   400,00  (40% recup.)  │
│  Faturamento realizado    R$   160,00  (40% do lucro)│
│  A faturar                R$   240,00                │
└──────────────────────────────────────────────────────┘
```

## 5.3 — Tabela de parcelas — nova coluna Split

Na tabela de parcelas do detalhe do empréstimo, adicionar colunas
visíveis apenas para admin/financeiro/consultor:

```
Nº  | Vencimento | Total    | Capital  | Lucro    | Status
────┼────────────┼──────────┼──────────┼──────────┼──────────
1   | 01/04/26   | R$280,00 | R$200,00 | R$80,00  | ✅ Pago
2   | 01/05/26   | R$280,00 | R$200,00 | R$80,00  | ✅ Pago
3   | 01/06/26   | R$280,00 | R$200,00 | R$80,00  | 🔵 Pendente
4   | 01/07/26   | R$280,00 | R$200,00 | R$80,00  | ⏳ Aguardando
5   | 01/08/26   | R$280,00 | R$200,00 | R$80,00  | ⏳ Aguardando
```

Tooltip ao passar o mouse sobre o valor de lucro de uma parcela paga:
"R$ 80,00 de faturamento confirmado nesta parcela."

## 5.4 — Relatórios (/relatorios) — nova aba Faturamento

Adicionar uma nova aba "Faturamento" ao lado das abas existentes:

```
┌──────────────────────────────────────────────────────┐
│  Faturamento Mensal              Maio 2026 ▼         │
├──────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Total        │ │ Faturamento  │ │ Recuperação  │ │
│  │ Recebido     │ │ Bruto        │ │ de Capital   │ │
│  │ R$ 1.400,00  │ │ R$   400,00  │ │ R$ 1.000,00  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ │
│                                                      │
│  Verificação: R$400 + R$1.000 = R$1.400 ✅           │
│                                                      │
│  Parcelas pagas no período: 5                        │
├──────────────────────────────────────────────────────┤
│  Faturamento por Consultor          (se aplicável)   │
│  ──────────────────────────────────────────────────  │
│  João Consultor    3 parcelas   R$ 240,00 faturado  │
│  Maria Consultora  2 parcelas   R$ 160,00 faturado  │
└──────────────────────────────────────────────────────┘
```

Seletor de mês: input type="month" + botão "Gerar".
Chamar GET /api/reports/faturamento?mes=2026-05.

## 5.5 — Dashboard: atualizar card "Empréstimos Ativos"

O card atual mostra apenas a quantidade. Adicionar um sub-indicador:

```
┌──────────────────────────────────┐
│ Empréstimos Ativos               │
│        8                         │
│ ─────────────────────────────── │
│ A faturar:  R$ 3.200,00          │
│ Capital em risco: R$ 8.000,00    │
└──────────────────────────────────┘
```

═══════════════════════════════════════════════════════════════════
PARTE 6 — AUDITORIA E SNAPSHOTS
═══════════════════════════════════════════════════════════════════

Ao registrar um pagamento (PaymentsService), criar snapshot imutável
no AuditLog com o estado da parcela antes e depois do pagamento:

```typescript
await tx.auditLog.create({
  data: {
    userId:     operadorId,
    acao:       'PAYMENT_REGISTRADO',
    entidade:   'installments',
    entidadeId: installmentId,
    dados: {
      snapshot: {
        antes: {
          status:           installment.status,
          totalPago:        installment.totalPago.toString(),
          installmentAmount: installment.installmentAmount.toString(),
          principalPayback:  installment.principalPayback.toString(),
          netGain:           installment.netGain.toString(),
        },
        depois: {
          status:    novoStatus,
          totalPago: novoTotalPago.toString(),
        },
        pagamento: {
          valorPago:         valorPago.toString(),
          metodoPagamento:   metodo,
          parcela_split: {
            principalPayback: installment.principalPayback.toString(),
            netGain:          installment.netGain.toString(),
          }
        }
      }
    }
  }
});
```

═══════════════════════════════════════════════════════════════════
ENTREGÁVEIS — ORDEM DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════

Implemente nesta ordem exata. Aguarde confirmação após cada grupo.

GRUPO A — Schema e Migration
  1. Migration Prisma:
     - Renomear campos em Loan e Installment
     - Adicionar principalPayback, netGain, totalReceivable
     - Script de retrocompatibilidade para dados históricos
     - Verificação: npx prisma migrate dev --name split_parcela

GRUPO B — Lógica de Negócio (Backend)
  2. Instalar decimal.js: npm install decimal.js
  3. LoansService.createLoan() com algoritmo de split e ajuste de centavos
  4. LoansService.verificarIntegridadeLoan() utilitário
  5. LoansDto: CreateLoanDto com novos campos
  6. Atualizar respostas de GET /api/loans e GET /api/loans/:id
     para retornar os novos campos

GRUPO C — Relatórios (Backend)
  7. ReportsService.getFaturamentoMensal()
  8. ReportsService.getCarteira() atualizado com nova nomenclatura
  9. ReportsController: GET /api/reports/faturamento?mes=

GRUPO D — Auditoria
  10. PaymentsService: snapshot no AuditLog ao registrar pagamento
  11. LoansService: snapshot no AuditLog ao criar empréstimo

GRUPO E — RLS e Supabase
  12. SQL Editor Supabase: políticas RLS para loans e installments
  13. Confirmar que ClientPortalService exclui net_gain e
      principal_payback dos SELECTs do portal

GRUPO F — Frontend
  14. Formulário novo empréstimo: campos atualizados + simulação
  15. Detalhe do empréstimo: resumo + seção Split + tabela com colunas
  16. Nova aba "Faturamento" em /relatorios
  17. Card do dashboard: sub-indicadores de faturamento

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS INVIOLÁVEIS
═══════════════════════════════════════════════════════════════════

- decimal.js em TODO cálculo financeiro — zero uso de number nativo
  para principalAmount, targetProfit, principalPayback, netGain
- Invariante sempre verificada: installmentAmount = principalPayback + netGain
- Ajuste de centavos SEMPRE na última parcela — nunca distribuído
- $transaction do Prisma em toda criação de Loan + Installments
- AuditLog snapshot em criação de Loan e registro de Payment
- net_gain e principal_payback são campos INTERNOS — nunca retornar
  em endpoints do portal (/api/portal/*)
- targetProfit é obrigatório — não há mais empréstimo sem lucro definido
- taxaJuros mantido no schema apenas para retrocompatibilidade de dados
  históricos — não usar em novos registros
- Seguir nomenclatura exata deste prompt em todo o código gerado:
  principalAmount, targetProfit, totalReceivable,
  installmentAmount, principalPayback, netGain
```
