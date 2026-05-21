# SIAFI 2.0 — Ajustes de Edge Cases no Fluxo de Empréstimos
# Expiração de proposta, pagamentos parciais e liberação manual de capital
# Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md
e os resultados das Fases 1, 2 e 3 já implementadas.

---

```
Você é um Engenheiro de Software Sênior e Arquiteto de Sistemas.
Precisamos corrigir três pontos cegos no fluxo de empréstimos do SIAFI
que foram identificados após análise operacional. Leia toda a
documentação antes de implementar. Entregue um grupo por vez.

═══════════════════════════════════════════════════════════════════
CONTEXTO — O QUE PRECISA SER CORRIGIDO
═══════════════════════════════════════════════════════════════════

Três cenários não cobertos pelo fluxo atual:

1. EXPIRAÇÃO DE PROPOSTA: o financeiro aprova a intenção, o portal é
   ativado, mas o cliente não acessa o sistema para assinar digitalmente.
   O contrato fica em limbo, prendendo capital mental da operação.

2. PAGAMENTOS PARCIAIS: o losango "parcela foi paga?" é binário. No
   mundo real o cliente paga R$300 de uma parcela de R$500, gerando
   um saldo devedor de R$200 que precisa continuar rendendo mora.

3. LIBERAÇÃO MANUAL DE CAPITAL: o aceite digital não pode ativar o
   contrato imediatamente — há um intervalo entre a assinatura e a
   entrega física do dinheiro (espécie, PIX ou TED). O caixa precisa
   confirmar a entrega antes de o sistema registrar a saída.

═══════════════════════════════════════════════════════════════════
PARTE 1 — EXPIRAÇÃO DE PROPOSTA (SLA de aceite)
═══════════════════════════════════════════════════════════════════

## 1.1 — Regra de negócio

Após a aprovação da intenção de empréstimo pelo financeiro:
- O sistema gera o Loan com status `aguardando_aceite`
- O cliente tem 7 dias corridos para entrar no portal e assinar
  (configurável via site_settings: 'financeiro.sla_aceite_dias')
- Se o cliente não assinar dentro do prazo:
  - O Loan é cancelado automaticamente (status = `cancelado`)
  - As installments geradas são canceladas
  - O portal do cliente NÃO é desativado (ele pode ter outros contratos)
  - O consultor é notificado via BullMQ
  - A IntencaoEmprestimo volta para status `aprovado` (não convertido)
    para que possa ser reaprovada sem reprocessar toda a análise
  - AuditLog: PROPOSTA_EXPIRADA com snapshot do Loan cancelado
- Alertas automáticos antes da expiração:
  - D-2: notificação ao cliente via WhatsApp ("Sua proposta expira em 2 dias")
  - D-1: notificação ao consultor ("Cliente não assinou — cobrar contato")
  - D+0: cancelamento automático via Cron

## 1.2 — Alterações no schema Prisma

```prisma
enum LoanStatus {
  aguardando_aceite   // novo — entre aprovação e aceite do cliente
  aguardando_liberacao // novo — entre aceite e confirmação do caixa
  ativo
  quitado
  cancelado
  inadimplente
}

model Loan {
  // ... campos existentes ...

  // Novos campos para SLA de aceite
  aceiteExpiraEm      DateTime? @map("aceite_expira_em")
  // Calculado na criação: createdAt + sla_aceite_dias

  aceiteSlaNotificado Boolean   @default(false) @map("aceite_sla_notificado")
  // true quando D-2 foi enviado ao cliente

  aceiteSlaConsultor  Boolean   @default(false) @map("aceite_sla_consultor")
  // true quando D-1 foi enviado ao consultor

  // Campos para liberação de capital (Parte 3)
  liberadoPor         Int?      @map("liberado_por")
  liberadoEm          DateTime? @map("liberado_em")
  metodoLiberacao     String?   @db.VarChar(20) @map("metodo_liberacao")
  // 'dinheiro' | 'pix' | 'ted' | 'transferencia'
}
```

## 1.3 — Cron Job: verificar SLA de aceite

Adicionar em CronService — rodar diariamente às 07:00:

```typescript
@Cron('0 7 * * *')
async verificarSlaAceite() {
  const agora = new Date();

  // D-2: notificar cliente
  const em2dias = addDays(agora, 2);
  const paraNotificarCliente = await this.prisma.loan.findMany({
    where: {
      status: 'aguardando_aceite',
      aceiteSlaNotificado: false,
      aceiteExpiraEm: { lte: em2dias }
    },
    include: { client: true }
  });
  for (const loan of paraNotificarCliente) {
    await this.notifQueue.add('whatsapp.proposta-expirando', {
      clientId:      loan.clientId,
      clienteNome:   loan.client.nome,
      clienteWhatsapp: loan.client.whatsapp,
      diasRestantes: 2,
      loanId:        loan.id,
    });
    await this.prisma.loan.update({
      where: { id: loan.id },
      data: { aceiteSlaNotificado: true }
    });
  }

  // D-1: notificar consultor
  const em1dia = addDays(agora, 1);
  const paraNotificarConsultor = await this.prisma.loan.findMany({
    where: {
      status: 'aguardando_aceite',
      aceiteSlaConsultor: false,
      aceiteExpiraEm: { lte: em1dia },
      client: { consultorId: { not: null } }
    },
    include: { client: { include: { consultor: true } } }
  });
  for (const loan of paraNotificarConsultor) {
    await this.notifQueue.add('whatsapp.proposta-consultor-alerta', {
      consultorId: loan.client.consultorId,
      clienteNome: loan.client.nome,
      loanId:      loan.id,
    });
    await this.prisma.loan.update({
      where: { id: loan.id },
      data: { aceiteSlaConsultor: true }
    });
  }

  // D+0: cancelar propostas expiradas
  const expiradas = await this.prisma.loan.findMany({
    where: {
      status: 'aguardando_aceite',
      aceiteExpiraEm: { lt: agora }
    },
    include: { client: true }
  });

  for (const loan of expiradas) {
    await this.prisma.$transaction(async (tx) => {
      // Cancelar loan e installments
      await tx.loan.update({
        where: { id: loan.id },
        data: { status: 'cancelado' }
      });
      await tx.installment.updateMany({
        where: { loanId: loan.id, status: { in: ['pendente'] } },
        data: { status: 'cancelado' }
      });
      // Reverter IntencaoEmprestimo para 'aprovado' (não convertido)
      await tx.intencaoEmprestimo.updateMany({
        where: { loanId: loan.id },
        data: { status: 'aprovado', loanId: null }
      });
      // AuditLog
      await tx.auditLog.create({
        data: {
          acao: 'PROPOSTA_EXPIRADA',
          entidade: 'loans',
          entidadeId: loan.id,
          dados: {
            clientId: loan.clientId,
            aceiteExpiraEm: loan.aceiteExpiraEm,
            motivo: 'Cliente não assinou dentro do prazo'
          }
        }
      });
      // Notificar consultor
      await this.notifQueue.add('whatsapp.proposta-expirada', {
        clienteNome: loan.client.nome,
        loanId: loan.id,
      });
    });
  }
}
```

═══════════════════════════════════════════════════════════════════
PARTE 2 — PAGAMENTOS PARCIAIS
═══════════════════════════════════════════════════════════════════

## 2.1 — Regra de negócio

O campo `totalPago` já existe em `Installment`. O que precisa mudar:

- Status atual é binário: `pendente` → `pago`
- Novo status intermediário: `parcialmente_pago`
- Mora diária incide sobre o SALDO DEVEDOR (não sobre o valor total)
- Saldo devedor = `valor` - `totalPago`
- A mora é calculada sobre o saldo devedor a cada dia de atraso

## 2.2 — Alteração no enum e schema

```prisma
enum InstallmentStatus {
  pendente
  parcialmente_pago  // novo
  pago
  atrasado
  cancelado
}

model Installment {
  // ... campos existentes ...

  // Novos campos para controle de mora sobre saldo parcial
  saldoDevedor    Decimal  @default(0) @db.Decimal(10,2) @map("saldo_devedor")
  // Calculado: valor - totalPago. Atualizado a cada pagamento.

  moraAcumulada   Decimal  @default(0) @db.Decimal(10,2) @map("mora_acumulada")
  // Mora diária acumulada sobre o saldoDevedor desde o vencimento
}
```

## 2.3 — PaymentsService: lógica de pagamento parcial

```typescript
async registrarPagamento(dto: CreatePaymentDto, operadorId: number) {
  return this.prisma.$transaction(async (tx) => {
    const installment = await tx.installment.findUnique({
      where: { id: dto.installmentId },
      include: { loan: true }
    });

    const valorPago     = new Decimal(dto.valorPago.toString());
    const valorTotal    = new Decimal(installment.valor.toString());
    const totalPagoAnt  = new Decimal(installment.totalPago.toString());
    const novoTotalPago = totalPagoAnt.plus(valorPago);
    const novoSaldo     = valorTotal.minus(novoTotalPago);

    // Validar: não pode pagar mais que o saldo devedor
    if (novoTotalPago.greaterThan(valorTotal.plus(installment.moraAcumulada))) {
      throw new BadRequestException('Valor pago excede o saldo devedor com mora.');
    }

    // Determinar novo status
    const novoStatus: InstallmentStatus = novoSaldo.lessThanOrEqualTo(0)
      ? 'pago'
      : 'parcialmente_pago';

    // Atualizar installment
    await tx.installment.update({
      where: { id: dto.installmentId },
      data: {
        totalPago:    novoTotalPago.toDecimalPlaces(2).toNumber(),
        saldoDevedor: novoSaldo.lessThan(0)
          ? 0
          : novoSaldo.toDecimalPlaces(2).toNumber(),
        status: novoStatus,
      }
    });

    // Criar Payment
    await tx.payment.create({
      data: {
        installmentId:  dto.installmentId,
        valorPago:      valorPago.toDecimalPlaces(2).toNumber(),
        dataPagamento:  new Date(dto.dataPagamento),
        metodoPagamento: dto.metodoPagamento,
        observacao:     dto.observacao,
      }
    });

    // Criar Transaction de entrada no caixa
    await tx.transaction.create({
      data: {
        tipo:      'entrada',
        valor:     valorPago.toDecimalPlaces(2).toNumber(),
        descricao: `Pagamento ${novoStatus === 'pago' ? 'total' : 'parcial'} — Parcela ${installment.numero}/${installment.loan.numeroParcelas}`,
        categoria: 'Pagamento de Parcela',
        data:      new Date(dto.dataPagamento),
        userId:    operadorId,
      }
    });

    // Se quitou a parcela: verificar se loan está totalmente pago
    if (novoStatus === 'pago') {
      const todasPagas = await tx.installment.count({
        where: { loanId: installment.loanId, status: { not: 'pago' }, NOT: { status: 'cancelado' } }
      });
      if (todasPagas === 0) {
        await tx.loan.update({
          where: { id: installment.loanId },
          data: { status: 'quitado' }
        });
      }
    }

    // AuditLog com snapshot before/after
    await tx.auditLog.create({
      data: {
        userId:     operadorId,
        acao:       'PAYMENT_REGISTRADO',
        entidade:   'installments',
        entidadeId: dto.installmentId,
        dados: {
          antes: {
            status:      installment.status,
            totalPago:   totalPagoAnt.toString(),
            saldoDevedor: installment.saldoDevedor.toString(),
          },
          depois: {
            status:      novoStatus,
            totalPago:   novoTotalPago.toString(),
            saldoDevedor: novoSaldo.lessThan(0) ? '0' : novoSaldo.toString(),
          },
          pagamento: {
            valorPago:    valorPago.toString(),
            metodo:       dto.metodoPagamento,
            parcial:      novoStatus === 'parcialmente_pago',
          }
        }
      }
    });
  });
}
```

## 2.4 — Cron: mora sobre saldo devedor de parcialmente_pago

Adicionar ao cron `markOverdue` (08h):

```typescript
// Além de marcar como atrasado, calcular mora sobre parcialmente_pagas
const parcialmentePagas = await this.prisma.installment.findMany({
  where: {
    status: 'parcialmente_pago',
    dataVencimento: { lt: new Date() }
  }
});

const moraPerc = await this.settings.get('financeiro.mora_dia_percentual');

for (const inst of parcialmentePagas) {
  const saldo      = new Decimal(inst.saldoDevedor.toString());
  const mora       = saldo.times(new Decimal(moraPerc).dividedBy(100));
  const novasMora  = new Decimal(inst.moraAcumulada.toString()).plus(mora);

  await this.prisma.installment.update({
    where: { id: inst.id },
    data: {
      moraAcumulada: novasMora.toDecimalPlaces(2).toNumber(),
      status: 'atrasado',
    }
  });
}
```

## 2.5 — Frontend: exibir saldo devedor e mora

Na tabela de parcelas do detalhe do contrato, atualizar colunas:

```
Nº | Vencimento | Total    | Pago     | Saldo    | Mora     | Status
───┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────────
3  | 01/06/26   | R$500,00 | R$300,00 | R$200,00 | R$ 6,60  | ⚠ Parcial
```

Badge visual: `⚠ Parcialmente pago` em amber, com tooltip mostrando
data do último pagamento parcial e saldo restante.

No formulário de pagamento, pré-preencher o campo "Valor pago" com
`saldoDevedor + moraAcumulada` (total para quitar a parcela),
mas permitir ao operador digitar qualquer valor > 0.

═══════════════════════════════════════════════════════════════════
PARTE 3 — LIBERAÇÃO MANUAL DE CAPITAL
═══════════════════════════════════════════════════════════════════

## 3.1 — Regra de negócio

Fluxo após o aceite digital:

```
Aceite digital do cliente
        ↓
Loan.status = 'aguardando_liberacao'
        ↓
Operador (caixa ou financeiro) vê pendência no painel
        ↓
Operador entrega o dinheiro (espécie, PIX ou TED)
        ↓
Operador clica "Confirmar liberação" + seleciona método
        ↓
Sistema:
  → Loan.status = 'ativo'
  → Transaction de saída no caixa
  → dataInicio das parcelas = hoje (ou data informada pelo operador)
  → Primeira parcela vence em dataInicio + 1 mês
  → AuditLog: CAPITAL_LIBERADO
```

A data de início das parcelas NÃO é mais definida no cadastro —
é definida no momento da confirmação da liberação pelo operador.
Isso garante que o prazo começa a contar da entrega real do dinheiro.

## 3.2 — Novo endpoint

```
PATCH /api/loans/:id/liberar-capital
Roles: admin, financeiro, caixa
```

```typescript
// DTO
export class LiberarCapitalDto {
  @IsEnum(['dinheiro', 'pix', 'ted', 'transferencia'])
  metodoLiberacao: string;

  @IsDateString()
  @IsOptional()
  dataLiberacao?: string;
  // Se não informada: usar data atual

  @IsString()
  @IsOptional()
  observacao?: string;
}

// Service
async liberarCapital(loanId: number, dto: LiberarCapitalDto, operador: User) {
  const loan = await this.prisma.loan.findUnique({
    where: { id: loanId },
    include: { installments: true, client: true }
  });

  if (!loan) throw new NotFoundException('Contrato não encontrado.');
  if (loan.status !== 'aguardando_liberacao') {
    throw new BadRequestException(
      'Contrato não está aguardando liberação de capital.'
    );
  }

  const dataLib = dto.dataLiberacao
    ? new Date(dto.dataLiberacao)
    : new Date();

  return this.prisma.$transaction(async (tx) => {
    // 1. Ativar o contrato
    await tx.loan.update({
      where: { id: loanId },
      data: {
        status:           'ativo',
        dataInicio:       dataLib,
        liberadoPor:      operador.id,
        liberadoEm:       dataLib,
        metodoLiberacao:  dto.metodoLiberacao,
      }
    });

    // 2. Atualizar datas de vencimento das installments
    //    (foram geradas com data provisória — agora ajustar)
    const installments = await tx.installment.findMany({
      where: { loanId, status: 'pendente' },
      orderBy: { numero: 'asc' }
    });
    for (const inst of installments) {
      await tx.installment.update({
        where: { id: inst.id },
        data: {
          dataVencimento: addMonths(dataLib, inst.numero)
        }
      });
    }

    // 3. Registrar saída no caixa
    await tx.transaction.create({
      data: {
        tipo:      'saida',
        valor:     loan.principalAmount,
        descricao: `Liberação de capital — Contrato #${loanId} · ${loan.client.nome}`,
        categoria: 'Liberação de Empréstimo',
        data:      dataLib,
        userId:    operador.id,
      }
    });

    // 4. AuditLog
    await tx.auditLog.create({
      data: {
        userId:     operador.id,
        acao:       'CAPITAL_LIBERADO',
        entidade:   'loans',
        entidadeId: loanId,
        dados: {
          metodo:    dto.metodoLiberacao,
          valor:     loan.principalAmount.toString(),
          dataLib:   dataLib.toISOString(),
          clientId:  loan.clientId,
        }
      }
    });

    // 5. Notificar cliente via WhatsApp
    await this.notifQueue.add('whatsapp.capital-liberado', {
      clientId:    loan.clientId,
      clienteNome: loan.client.nome,
      clienteWhatsapp: loan.client.whatsapp,
      valor:       loan.principalAmount.toString(),
      metodo:      dto.metodoLiberacao,
      primeiraParcela: addMonths(dataLib, 1).toISOString(),
    });
  });
}
```

## 3.3 — Painel operacional: fila de liberações pendentes

Criar nova seção no dashboard do caixa e financeiro:

```
┌──────────────────────────────────────────────────────────────┐
│  Liberações pendentes                            2 contratos │
├──────────────────────────────────────────────────────────────┤
│  João da Silva   · Contrato #42 · R$ 2.000,00               │
│  Aceite assinado em: 20/05/2026 às 14:32                    │
│  [ Confirmar liberação → ]                                   │
├──────────────────────────────────────────────────────────────┤
│  Maria Souza     · Contrato #43 · R$ 1.500,00               │
│  Aceite assinado em: 20/05/2026 às 16:10                    │
│  [ Confirmar liberação → ]                                   │
└──────────────────────────────────────────────────────────────┘
```

Modal "Confirmar liberação":
```
┌──────────────────────────────────────────────────────────────┐
│  Confirmar liberação de capital                              │
├──────────────────────────────────────────────────────────────┤
│  Cliente:  João da Silva                                     │
│  Valor:    R$ 2.000,00                                       │
│                                                              │
│  Método de entrega *                                         │
│  ○ Dinheiro em espécie                                       │
│  ○ PIX                                                       │
│  ○ TED / Transferência bancária                              │
│                                                              │
│  Data de liberação *                                         │
│  [ 21/05/2026 ▼ ]   (padrão: hoje)                          │
│                                                              │
│  Observação (opcional)                                       │
│  [ __________________________ ]                              │
│                                                              │
│  ⚠ Esta ação iniciará a contagem das parcelas.              │
│                                                              │
│  [ Cancelar ]        [ Confirmar e ativar contrato ]         │
└──────────────────────────────────────────────────────────────┘
```

## 3.4 — Realtime: notificar caixa ao receber aceite

Quando o cliente assinar digitalmente no portal, disparar evento
Supabase Realtime para atualizar o painel do caixa/financeiro:

```typescript
// Tabela loans está na publication supabase_realtime
// Frontend escuta UPDATE em loans onde status = 'aguardando_liberacao'
// Ao receber: incrementar badge "Liberações pendentes" no dashboard
```

═══════════════════════════════════════════════════════════════════
ENTREGÁVEIS — ORDEM DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════

GRUPO A — Schema e enum
  1. Migration Prisma:
     - Adicionar 'aguardando_aceite' e 'aguardando_liberacao' em LoanStatus
     - Adicionar 'parcialmente_pago' em InstallmentStatus
     - Campos aceiteExpiraEm, aceiteSlaNotificado, aceiteSlaConsultor em Loan
     - Campos liberadoPor, liberadoEm, metodoLiberacao em Loan
     - Campos saldoDevedor, moraAcumulada em Installment

GRUPO B — Lógica de aceite e expiração
  2. IntencaoService.aprovarIntencao():
     - Loan criado com status 'aguardando_aceite' (não 'ativo')
     - aceiteExpiraEm = createdAt + sla_aceite_dias (site_settings)
     - dataInicio das parcelas: provisória (será atualizada na liberação)
  3. PortalService.aceitarContrato():
     - Loan.status → 'aguardando_liberacao' (não 'ativo')
  4. CronService.verificarSlaAceite() — 07h diário

GRUPO C — Liberação manual de capital
  5. LiberarCapitalDto
  6. LoansService.liberarCapital() com $transaction completa
  7. LoansController: PATCH /api/loans/:id/liberar-capital
  8. Frontend: seção "Liberações pendentes" no dashboard (caixa + financeiro)
  9. Frontend: modal de confirmação de liberação
  10. Realtime: badge de liberações pendentes

GRUPO D — Pagamentos parciais
  11. PaymentsService.registrarPagamento() com saldo devedor
  12. CronService.markOverdue(): adicionar mora em parcialmente_pago
  13. Frontend: tabela de parcelas com colunas Pago / Saldo / Mora
  14. Frontend: badge "Parcialmente pago" na tabela
  15. Frontend: pré-preencher formulário com saldoDevedor + moraAcumulada

GRUPO E — Seed de novas configurações
  16. Adicionar em site_settings:
      'financeiro.sla_aceite_dias'   → default: '7'
      'financeiro.mora_dia_percentual' → já existe, confirmar

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS OBRIGATÓRIAS
═══════════════════════════════════════════════════════════════════
- decimal.js em TODO cálculo de mora, saldo devedor e pagamento parcial
- $transaction em liberarCapital (ativar loan + ajustar parcelas + Transaction)
- $transaction em registrarPagamento (Payment + Installment + Transaction)
- Saída no caixa (Transaction) APENAS em liberarCapital — nunca no aceite
- dataInicio das parcelas definida em liberarCapital — não no cadastro
- AuditLog obrigatório em: PROPOSTA_EXPIRADA, CAPITAL_LIBERADO, PAYMENT_REGISTRADO
- Loan criado com status 'aguardando_aceite' — nunca 'ativo' direto
- Parcela 'parcialmente_pago' acumula mora sobre saldoDevedor — não sobre valor total
- Reverter IntencaoEmprestimo para 'aprovado' ao expirar (não para 'aguardando')
- Portal do cliente NÃO desativar ao expirar proposta
```
