# SIAFI 2.0 — Fluxo Completo: Intenção de Empréstimo, Reparcelamento e Comunicador Interno
# Prompt de Arquitetura e Negócio — Maio 2026

Cole em uma nova conversa com os arquivos:
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md
+ SKILL.md (siafi-roles-consultor)
+ Resultado do PROMPT_FASE1 (ConsultorModule já implementado)

---

```
Você é um Engenheiro de Software Sênior e Arquiteto de Sistemas. Analise
toda a documentação do SIAFI 2.0 antes de escrever qualquer código.

Vamos implementar três módulos interligados que formam o coração operacional
do sistema: o fluxo completo de intenção de empréstimo com aprovação pelo
financeiro, o fluxo de reparcelamento solicitado pelo cliente, e o
comunicador interno entre grupos e usuários com suporte a documentos.

Leia tudo. Pergunte se houver dúvida. Entregue um grupo por vez.

═══════════════════════════════════════════════════════════════════
CONTEXTO — O QUE JÁ EXISTE
═══════════════════════════════════════════════════════════════════

Da Fase 1 já implementada:
- Model IntencaoEmprestimo: clientId, consultorId, valorSolicitado,
  numeroParcelas, finalidade, status (aguardando|aprovado|rejeitado|convertido),
  aprovadoPor, aprovadoEm, loanId?
- Model ConsultorSolicitacao: tipos desconto|reparcelamento|intencao|outro
- Endpoints GET/PATCH /api/intencoes e /api/solicitacoes (financeiro aprova)
- Endpoints POST /api/consultor/intencoes e /api/consultor/solicitacoes

O que ainda NÃO existe e vamos criar aqui:
- SLA automático com notificações por prazo
- Fluxo de ativação do portal vinculado à aprovação
- Aceite digital do cliente no portal
- Reparcelamento completo com cancelamento do contrato original
- Multa e mora configuráveis
- Score de risco interno do cliente
- Comunicador interno completo
- Simulador de reparcelamento para o financeiro

═══════════════════════════════════════════════════════════════════
PARTE 1 — SCHEMA PRISMA: NOVOS MODELS E CAMPOS
═══════════════════════════════════════════════════════════════════

## 1.1 — Atualizar model IntencaoEmprestimo

Adicionar os campos que faltam:

```prisma
model IntencaoEmprestimo {
  // ... campos existentes da Fase 1 ...

  // Novos campos
  motivoRejeicao      String?   @db.Text @map("motivo_rejeicao")
  motivoRejeicaoTipo  String?   @db.VarChar(50) @map("motivo_rejeicao_tipo")
  // Tipos predefinidos: 'score_baixo' | 'documentacao_incompleta' |
  //   'limite_atingido' | 'renda_insuficiente' | 'outro'

  prazoAnaliseHoras   Int       @default(24) @map("prazo_analise_horas")
  // Configurável por tipo — padrão 24h
  prazoExpiracaoEm    DateTime? @map("prazo_expiracao_em")
  // Calculado ao criar: createdAt + prazoAnaliseHoras

  slaNotificado       Boolean   @default(false) @map("sla_notificado")
  // true quando o cron enviou o alerta de prazo vencendo
  slaEscalonado       Boolean   @default(false) @map("sla_escalonado")
  // true quando escalou para admin

  // Feedback ao cliente
  feedbackEnviadoEm   DateTime? @map("feedback_enviado_em")
  feedbackEnviadoPor  Int?      @map("feedback_enviado_por")
  feedbackCanal       String?   @db.VarChar(20) @map("feedback_canal")
  // Canal: 'sistema' | 'whatsapp' | 'presencial'
}
```

## 1.2 — Atualizar model Loan para reparcelamento

```prisma
model Loan {
  // ... campos existentes ...

  // Rastreabilidade de reparcelamento
  origemLoanId        Int?      @unique @map("origem_loan_id")
  // FK para o contrato que foi cancelado e originou este
  // @unique porque um contrato cancelado gera exatamente 1 novo

  reparcelamentoCount Int       @default(0) @map("reparcelamento_count")
  // Quantas vezes este contrato já foi reparcelado
  // Herdado do contrato original no reparcelamento

  aceiteClienteEm     DateTime? @map("aceite_cliente_em")
  aceiteClienteIp     String?   @db.VarChar(45) @map("aceite_cliente_ip")
  aceiteClienteHash   String?   @db.VarChar(64) @map("aceite_cliente_hash")
  // SHA-256 do documento aceito — prova legal do aceite

  origemLoan          Loan?     @relation("ReparcelamentoOrigem",
                                  fields: [origemLoanId], references: [id])
  reparcelado         Loan?     @relation("ReparcelamentoOrigem")

  @@map("loans")
}
```

## 1.3 — Model SolicitacaoReparcelamento (novo — específico do cliente)

```prisma
model SolicitacaoReparcelamento {
  id                  Int       @id @default(autoincrement())
  clientId            Int       @map("client_id")
  loanId              Int       @map("loan_id")
  consultorId         Int?      @map("consultor_id")

  tipo                String    @db.VarChar(30) @map("tipo")
  // 'reparcelamento' | 'boleto_atualizado'

  motivoCliente       String    @db.Text @map("motivo_cliente")
  // Descrição do cliente sobre sua situação

  dataPrevistaPagamento DateTime? @map("data_prevista_pagamento")
  // Data informada pelo cliente para pagar

  status              String    @default("pendente") @db.VarChar(20)
  // 'pendente' | 'em_analise' | 'aprovado' | 'rejeitado' | 'cancelado'

  // Resposta do financeiro
  novoValorPrincipal  Decimal?  @db.Decimal(10,2) @map("novo_valor_principal")
  novoTargetProfit    Decimal?  @db.Decimal(10,2) @map("novo_target_profit")
  novoNumeroParcelas  Int?      @map("novo_numero_parcelas")
  novaDataInicio      DateTime? @map("nova_data_inicio")
  multaAplicada       Decimal?  @db.Decimal(10,2) @map("multa_aplicada")
  moraAplicada        Decimal?  @db.Decimal(10,2) @map("mora_aplicada")
  observacaoFinanceiro String?  @db.Text @map("observacao_financeiro")

  // Execução
  novoLoanId          Int?      @unique @map("novo_loan_id")
  // Preenchido após a criação do novo contrato

  respondidoPor       Int?      @map("respondido_por")
  respondidoEm        DateTime? @map("respondido_em")
  executadoPor        Int?      @map("executado_por")
  executadoEm         DateTime? @map("executado_em")

  // Aprovação em segunda instância (para reparcelamentos)
  aprovadoSegundaInstancia     Boolean   @default(false) @map("aprovado_segunda_instancia")
  aprovadoSegundaInstanciaPor  Int?      @map("aprovado_segunda_instancia_por")
  aprovadoSegundaInstanciaEm   DateTime? @map("aprovado_segunda_instancia_em")

  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  client    Client  @relation(fields: [clientId], references: [id])
  loan      Loan    @relation(fields: [loanId], references: [id])
  consultor User?   @relation(fields: [consultorId], references: [id])

  @@index([clientId])
  @@index([loanId])
  @@index([status])
  @@map("solicitacoes_reparcelamento")
}
```

## 1.4 — Model Mensagem (comunicador interno)

```prisma
model Mensagem {
  id            Int      @id @default(autoincrement())
  conversaId    Int      @map("conversa_id")
  remetenteId   Int      @map("remetente_id")
  // userId — quem enviou
  conteudo      String   @db.Text
  tipo          String   @db.VarChar(20) @default("texto")
  // 'texto' | 'documento' | 'sistema'
  // 'sistema': mensagens automáticas (ex: "Intenção #12 aprovada")
  arquivoPath   String?  @db.VarChar(500) @map("arquivo_path")
  // Path no Supabase Storage (bucket: 'mensagens-docs')
  arquivoNome   String?  @db.VarChar(255) @map("arquivo_nome")
  arquivoMime   String?  @db.VarChar(100) @map("arquivo_mime")
  lida          Boolean  @default(false)
  lidaEm        DateTime? @map("lida_em")
  createdAt     DateTime @default(now()) @map("created_at")

  conversa  Conversa @relation(fields: [conversaId], references: [id])
  remetente User     @relation(fields: [remetenteId], references: [id])

  @@index([conversaId])
  @@index([remetenteId])
  @@map("mensagens")
}

model Conversa {
  id            Int      @id @default(autoincrement())
  titulo        String?  @db.VarChar(255)
  // Opcional — gerado automaticamente se não informado

  tipo          String   @db.VarChar(30) @default("direto")
  // 'direto': entre dois usuários
  // 'grupo': múltiplos participantes
  // 'contexto': vinculada a uma entidade (intenção, contrato, solicitação)

  // Vínculo de contexto (opcional — pelo menos um deve ser preenchido
  // para conversas de tipo 'contexto')
  intencaoId    Int?     @map("intencao_id")
  loanId        Int?     @map("loan_id")
  solicitacaoId Int?     @map("solicitacao_id")
  clientId      Int?     @map("client_id")

  arquivada     Boolean  @default(false)
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  mensagens     Mensagem[]
  participantes ConversaParticipante[]

  @@index([intencaoId])
  @@index([loanId])
  @@map("conversas")
}

model ConversaParticipante {
  id          Int      @id @default(autoincrement())
  conversaId  Int      @map("conversa_id")
  userId      Int      @map("user_id")
  // Inclui tanto User (operadores) quanto pode ser expandido para Client
  role        String   @db.VarChar(20) @default("membro")
  // 'admin_conversa' | 'membro'
  silenciado  Boolean  @default(false)
  ultimaLeitura DateTime? @map("ultima_leitura")
  entradaEm   DateTime @default(now()) @map("entrada_em")

  conversa Conversa @relation(fields: [conversaId], references: [id])
  user     User     @relation(fields: [userId], references: [id])

  @@unique([conversaId, userId])
  @@map("conversa_participantes")
}
```

## 1.5 — Model ScoreRisco (score interno do cliente)

```prisma
model ScoreRisco {
  id              Int      @id @default(autoincrement())
  clientId        Int      @unique @map("client_id")

  // Componentes do score (0-100 cada)
  scorePontualidade     Int @default(100) @map("score_pontualidade")
  // Cai proporcionalmente a cada parcela atrasada
  scoreReparcelamentos  Int @default(100) @map("score_reparcelamentos")
  // Cai a cada reparcelamento solicitado
  scoreQuitacoes        Int @default(50)  @map("score_quitacoes")
  // Sobe a cada contrato quitado em dia
  scoreGeral            Int @default(75)  @map("score_geral")
  // Média ponderada: pontualidade 50% + reparcelamentos 30% + quitações 20%

  classificacao   String   @default("regular") @db.VarChar(20)
  // 'excelente' (85-100) | 'bom' (70-84) | 'regular' (50-69) | 'alto_risco' (<50)

  totalEmprestimos      Int @default(0) @map("total_emprestimos")
  totalQuitados         Int @default(0) @map("total_quitados")
  totalReparcelamentos  Int @default(0) @map("total_reparcelamentos")
  totalParcelasAtrasadas Int @default(0) @map("total_parcelas_atrasadas")

  calculadoEm   DateTime @default(now()) @map("calculado_em")
  updatedAt     DateTime @updatedAt @map("updated_at")

  client Client @relation(fields: [clientId], references: [id])

  @@map("scores_risco")
}
```

## 1.6 — Configurações de multa/mora em SiteSetting

Adicionar ao seed inicial as configurações financeiras:
```typescript
// Chaves a serem inseridas na tabela site_settings:
'financeiro.multa_atraso_percentual'  // default: '2.00'  (2% sobre o valor)
'financeiro.mora_dia_percentual'      // default: '0.033' (1% ao mês / 30 dias)
'financeiro.max_reparcelamentos'      // default: '3'
'financeiro.sla_intencao_horas'       // default: '24'
'financeiro.sla_escalona_horas'       // default: '48'
```

═══════════════════════════════════════════════════════════════════
PARTE 2 — FLUXO DE INTENÇÃO DE EMPRÉSTIMO (COMPLETO)
═══════════════════════════════════════════════════════════════════

## 2.1 — IntencaoService: criar intenção com SLA automático

```typescript
async criarIntencao(dto: CreateIntencaoDto, consultor: User) {
  // 1. Validar que o cliente pertence à carteira do consultor
  // 2. Verificar limite de contratos ativos do cliente
  // 3. Calcular prazo de expiração a partir do site_settings
  const slaHoras = await this.settings.get('financeiro.sla_intencao_horas');
  const prazoExpiracaoEm = addHours(new Date(), parseInt(slaHoras));

  // 4. Criar IntencaoEmprestimo com status 'aguardando'
  // 5. Criar Conversa de contexto automaticamente:
  //    - tipo: 'contexto'
  //    - titulo: `Intenção #${id} — ${cliente.nome}`
  //    - participantes: consultor + todos os financeiros ativos + admin
  //    - intencaoId: id da intenção criada
  //    - mensagem automática de sistema:
  //      "Intenção de empréstimo registrada pelo consultor {nome}.
  //       Valor: R$ {valor} | Parcelas: {n} | Finalidade: {finalidade}"
  // 6. Notificar financeiros via BullMQ (notif-queue)
  // 7. AuditLog: INTENCAO_CRIADA
}
```

## 2.2 — IntencaoService: aprovar com ativação do portal

```typescript
async aprovarIntencao(intencaoId: number, financeiro: User) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Atualizar status para 'aprovado' + aprovadoPor + aprovadoEm
    // 2. Criar o Loan automaticamente com os dados da intenção
    //    (usando a lógica de split de parcela do PROMPT_SPLIT_PARCELA)
    // 3. Atualizar intencao.loanId = loan.id + status = 'convertido'
    // 4. Verificar se o portal do cliente já está ativo:
    //    - Se NÃO: ativar automaticamente via PortalService.ativarPortal()
    //    - Se SIM: apenas notificar
    // 5. Enviar mensagem de sistema na Conversa da intenção:
    //    "✅ Intenção aprovada por {financeiro.nome}.
    //     Contrato #{loan.id} gerado automaticamente."
    // 6. Notificar consultor via BullMQ:
    //    - WhatsApp do consultor com resumo da aprovação
    // 7. Notificar cliente via WhatsApp + email com:
    //    - "Seu empréstimo foi aprovado! Acesse o portal."
    //    - Se portal acabou de ser ativado: incluir credenciais
    // 8. AuditLog: INTENCAO_APROVADA + snapshot do loan criado
  });
}
```

## 2.3 — IntencaoService: rejeitar com motivo

```typescript
async rejeitarIntencao(
  intencaoId: number,
  financeiro: User,
  motivoTipo: string,
  motivoTexto: string
) {
  // 1. Atualizar status para 'rejeitado' + motivo + respondidoPor
  // 2. Mensagem de sistema na Conversa:
  //    "❌ Intenção rejeitada. Motivo: {motivo}"
  // 3. Notificar consultor via BullMQ para repassar ao cliente
  // 4. AuditLog: INTENCAO_REJEITADA
  // Consultor decide como e quando informar o cliente (registra via feedbackEnviadoPor)
}
```

## 2.4 — IntencaoService: registrar feedback ao cliente

```typescript
async registrarFeedbackCliente(
  intencaoId: number,
  consultor: User,
  canal: 'sistema' | 'whatsapp' | 'presencial'
) {
  // Marca que o consultor informou o cliente
  // Atualiza feedbackEnviadoEm + feedbackEnviadoPor + feedbackCanal
  // Se canal = 'sistema': enfileira mensagem automática ao cliente
  //   via portal/WhatsApp com o resultado (aprovado/rejeitado + motivo)
}
```

## 2.5 — Cron Job: verificação de SLA

Adicionar em CronService:

```typescript
// A cada 2 horas — verificar intenções com SLA vencendo
@Cron('0 */2 * * *')
async verificarSlaIntencoes() {
  const agora = new Date();
  const em2horas = addHours(agora, 2);

  // Notificar: vencendo em até 2 horas e ainda não notificado
  const vencendo = await this.prisma.intencaoEmprestimo.findMany({
    where: {
      status: 'aguardando',
      slaNotificado: false,
      prazoExpiracaoEm: { lte: em2horas }
    }
  });
  // Enfileirar notificação de urgência para todos os financeiros

  // Escalonar: SLA vencido há mais de (sla_escalona_horas - sla_intencao_horas)
  const slaEscalona = await this.settings.get('financeiro.sla_escalona_horas');
  const limiteEscalona = subHours(agora, parseInt(slaEscalona));
  const vencidas = await this.prisma.intencaoEmprestimo.findMany({
    where: {
      status: 'aguardando',
      slaEscalonado: false,
      prazoExpiracaoEm: { lte: limiteEscalona }
    }
  });
  // Notificar admin: "Intenção #{id} está sem análise há {X}h"
}
```

═══════════════════════════════════════════════════════════════════
PARTE 3 — FLUXO DE REPARCELAMENTO
═══════════════════════════════════════════════════════════════════

## 3.1 — Portal do cliente: solicitar reparcelamento ou boleto atualizado

Novo endpoint no ClientPortalService:

```typescript
// POST /api/portal/reparcelamento
async solicitarReparcelamento(
  clientId: number,
  dto: {
    loanId: number;
    tipo: 'reparcelamento' | 'boleto_atualizado';
    motivoCliente: string;
    dataPrevistaPagamento?: string;
  }
) {
  // 1. Validar ownership: loan pertence ao cliente
  // 2. Validar que o loan está ativo ou inadimplente
  // 3. Verificar limite de reparcelamentos:
  const maxRepar = await this.settings.get('financeiro.max_reparcelamentos');
  const loan = await this.prisma.loan.findUnique({ where: { id: dto.loanId } });
  if (loan.reparcelamentoCount >= parseInt(maxRepar)) {
    throw new BadRequestException(
      'Limite de reparcelamentos atingido para este contrato. ' +
      'Entre em contato com seu consultor.'
    );
  }

  // 4. Verificar se já existe solicitação pendente para este loan
  const pendente = await this.prisma.solicitacaoReparcelamento.findFirst({
    where: { loanId: dto.loanId, status: { in: ['pendente', 'em_analise'] } }
  });
  if (pendente) throw new ConflictException('Já existe uma solicitação em análise.');

  // 5. Criar SolicitacaoReparcelamento
  // 6. Criar Conversa de contexto:
  //    - participantes: consultor do cliente + financeiros + admin
  //    - NÃO incluir o cliente na conversa interna operacional
  //    - mensagem de sistema com resumo da solicitação
  // 7. Criar lembrete automático se dataPrevistaPagamento informada:
  //    - Cron D-1: notificar caixa
  //    - Cron D+1 sem pagamento: notificar consultor
  // 8. Notificar consultor via WhatsApp/BullMQ
}
```

## 3.2 — FinanceiroService: propor termos do reparcelamento

```typescript
// PATCH /api/solicitacoes-reparcelamento/:id/proposta
async proporTermosReparcelamento(
  solicitacaoId: number,
  financeiro: User,
  dto: {
    novoValorPrincipal: string;
    novoTargetProfit: string;
    novoNumeroParcelas: number;
    novaDataInicio: string;
    observacaoFinanceiro: string;
  }
) {
  // 1. Calcular multa e mora automaticamente com base nas regras de site_settings
  const saldoDevedor = await this.calcularSaldoDevedor(solicitacao.loanId);
  const diasAtraso = await this.calcularDiasAtraso(solicitacao.loanId);
  const multaPerc = await this.settings.get('financeiro.multa_atraso_percentual');
  const moraPerc = await this.settings.get('financeiro.mora_dia_percentual');
  const multa = saldoDevedor.times(new Decimal(multaPerc).dividedBy(100));
  const mora  = saldoDevedor.times(new Decimal(moraPerc).dividedBy(100)).times(diasAtraso);

  // 2. Salvar proposta na SolicitacaoReparcelamento
  //    (novoValorPrincipal, novoTargetProfit, etc. + multaAplicada + moraAplicada)
  // 3. Status → 'em_analise'
  // 4. Enviar proposta ao consultor para ele mostrar ao cliente:
  //    - Mensagem na Conversa de contexto com simulação:
  //      "Proposta: {n} parcelas de R$ {valorParcela} | Multa: R$ {multa} | Mora: R$ {mora}"
}
```

## 3.3 — FinanceiroService: executar reparcelamento (2ª instância)

```typescript
// PATCH /api/solicitacoes-reparcelamento/:id/executar
// Requer: aprovadoSegundaInstancia = true (outro financeiro ou admin confirma)
async executarReparcelamento(solicitacaoId: number, executor: User) {
  return this.prisma.$transaction(async (tx) => {
    const solicitacao = await tx.solicitacaoReparcelamento.findUnique({
      where: { id: solicitacaoId },
      include: { loan: { include: { installments: true, client: true } } }
    });

    // 1. Verificar segunda aprovação
    if (!solicitacao.aprovadoSegundaInstancia) {
      throw new ForbiddenException(
        'Reparcelamento requer confirmação de um segundo aprovador.'
      );
    }

    // 2. Snapshot imutável do contrato original ANTES de cancelar
    const snapshotOrigem = {
      loanId:            solicitacao.loanId,
      principalAmount:   solicitacao.loan.principalAmount.toString(),
      targetProfit:      solicitacao.loan.targetProfit.toString(),
      totalReceivable:   solicitacao.loan.totalReceivable.toString(),
      numeroParcelas:    solicitacao.loan.numeroParcelas,
      parcelasPagas:     solicitacao.loan.installments.filter(i => i.status === 'pago').length,
      valorJaRecebido:   solicitacao.loan.installments
        .filter(i => i.status === 'pago')
        .reduce((acc, i) => acc.plus(i.totalPago.toString()), new Decimal(0)).toString(),
      dataStatus:        new Date().toISOString(),
    };

    // 3. Cancelar o empréstimo original + parcelas pendentes/atrasadas
    await tx.loan.update({
      where: { id: solicitacao.loanId },
      data: { status: 'cancelado' }
    });
    await tx.installment.updateMany({
      where: {
        loanId: solicitacao.loanId,
        status: { in: ['pendente', 'atrasado'] }
      },
      data: { status: 'cancelado' }
    });

    // 4. Criar novo empréstimo usando split de parcela
    //    origemLoanId = solicitacao.loanId
    //    reparcelamentoCount = solicitacao.loan.reparcelamentoCount + 1
    //    observacoes = "Reparcelamento do contrato #${origemLoanId}.
    //                   ${solicitacao.observacaoFinanceiro}"
    const novoLoan = await this.loansService.createLoan({
      clientId:       solicitacao.clientId,
      principalAmount: solicitacao.novoValorPrincipal.toString(),
      targetProfit:    solicitacao.novoTargetProfit.toString(),
      numeroParcelas:  solicitacao.novoNumeroParcelas,
      dataInicio:      solicitacao.novaDataInicio,
      origemLoanId:    solicitacao.loanId,
      reparcelamentoCount: solicitacao.loan.reparcelamentoCount + 1,
    }, executor.id, tx);

    // 5. Atualizar solicitação com novoLoanId + status executado
    await tx.solicitacaoReparcelamento.update({
      where: { id: solicitacaoId },
      data: {
        novoLoanId:  novoLoan.id,
        status:      'aprovado',
        executadoPor: executor.id,
        executadoEm: new Date(),
      }
    });

    // 6. AuditLog com snapshot completo
    await tx.auditLog.create({
      data: {
        userId:     executor.id,
        acao:       'REPARCELAMENTO_EXECUTADO',
        entidade:   'loans',
        entidadeId: novoLoan.id,
        dados: {
          snapshotOrigem,
          novoLoanId: novoLoan.id,
          solicitacaoId,
          multa: solicitacao.multaAplicada?.toString(),
          mora:  solicitacao.moraAplicada?.toString(),
        }
      }
    });

    // 7. Notificar consultor e cliente:
    //    - "Seu reparcelamento foi aprovado. Novo carnê disponível no portal."
    //    - Enfileirar geração do PDF do contrato (se implementado)

    return novoLoan;
  });
}
```

## 3.4 — Aceite digital no portal (antes de ativar contrato reparcelado)

No portal do cliente, antes de o reparcelamento se tornar ativo, exibir:

```typescript
// PATCH /api/portal/reparcelamento/:solicitacaoId/aceitar
async aceitarTermosReparcelamento(
  clientId: number,
  solicitacaoId: number,
  ip: string
) {
  // Verificar que a proposta foi feita e ainda aguarda aceite do cliente
  // Gerar hash SHA-256 do documento: JSON.stringify({ solicitacaoId, clientId,
  //   novoValorPrincipal, novoTargetProfit, novoNumeroParcelas, timestamp })
  const hash = crypto.createHash('sha256').update(docString).digest('hex');

  // Atualizar o Loan recém-criado com aceiteClienteEm + aceiteClienteIp + aceiteClienteHash
  // Liberar o acesso ao novo carnê no portal
  // AuditLog: ACEITE_REPARCELAMENTO_CLIENTE
}
```

═══════════════════════════════════════════════════════════════════
PARTE 4 — COMUNICADOR INTERNO
═══════════════════════════════════════════════════════════════════

## 4.1 — Matriz de permissões de comunicação

| Remetente   | Pode conversar com               | Pode criar grupo |
|-------------|----------------------------------|------------------|
| admin       | Qualquer usuário, qualquer grupo | Sim              |
| financeiro  | admin, outros financeiros, consultores | Sim         |
| consultor   | admin, financeiro, seus clientes | Não              |
| caixa       | admin, financeiro                | Não              |
| cliente     | Seu consultor apenas             | Não              |

Regras adicionais:
- Cliente NÃO pode abrir conversa com financeiro diretamente
- Toda conversa de contexto (vinculada a intenção/loan/solicitação)
  é criada automaticamente pelo sistema — não manualmente
- Consultor pode criar conversa direta com qualquer financeiro

## 4.2 — MensagemService

```typescript
// Endpoints:
// GET  /api/mensagens/conversas               → lista conversas do usuário
// GET  /api/mensagens/conversas/:id           → mensagens da conversa (paginado)
// POST /api/mensagens/conversas               → criar nova conversa direta
// POST /api/mensagens/conversas/:id/mensagens → enviar mensagem
// POST /api/mensagens/conversas/:id/documentos → upload de doc
// PATCH /api/mensagens/conversas/:id/lida     → marcar conversa como lida

async enviarMensagem(conversaId: number, remetente: User, dto: EnviarMensagemDto) {
  // 1. Validar que remetente é participante da conversa
  // 2. Validar permissão de comunicação (matriz acima)
  // 3. Se dto.arquivo: upload via SupabaseService para bucket 'mensagens-docs'
  //    path: {conversaId}/{timestamp}_{nomeArquivo}
  //    Tipos permitidos: PDF, JPEG, PNG, WEBP (max 10MB)
  // 4. Criar Mensagem
  // 5. Atualizar conversa.updatedAt para ordenação por recência
  // 6. Notificar participantes via Supabase Realtime (canal 'mensagens-{userId}')
  // 7. Se algum participante tiver WhatsApp e a mensagem for urgente:
  //    enfileirar notificação via notif-queue
}
```

## 4.3 — Frontend: Comunicador (/mensagens)

### Layout da tela principal

```
┌──────────────────────────────────────────────────────────────────┐
│  CONVERSAS                                [+ Nova conversa]      │
│  ─────────────────────────────────────────────────────────────── │
│  🔵 Intenção #15 — João da Silva         Hoje 14:32  ●  (não lido)│
│     "Aprovação pendente há 2h..."                                │
│  ─────────────────────────────────────────────────────────────── │
│     Contrato #8 — Reparcelamento         Ontem 09:15             │
│     "Proposta enviada ao cliente..."                             │
│  ─────────────────────────────────────────────────────────────── │
│     Carlos Financeiro                    20/05 17:40             │
│     "Ok, vou analisar ainda hoje"                                │
└──────────────────────────────────────────────────────────────────┘
```

### Layout da conversa aberta

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Voltar   Intenção #15 — João da Silva                [Info]  │
│  ─────────────────────────────────────────────────────────────── │
│                          [Mensagem de sistema]                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ ⚙ Intenção registrada por João Consultor.                   │ │
│  │   Valor: R$ 2.000 | 6x | Finalidade: Capital de giro        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  João Consultor  14:30                                           │
│  ┌────────────────────────────────┐                             │
│  │ Cliente tem renda comprovada   │                             │
│  │ de R$ 4.500. Docs em anexo.    │                             │
│  └────────────────────────────────┘                             │
│  📎 comprovante_renda.pdf                                        │
│                                                                  │
│                       Maria Financeiro  14:45                    │
│              ┌─────────────────────────────────────┐            │
│              │ Recebido. Vou analisar até às 17h.   │            │
│              └─────────────────────────────────────┘            │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│  [  Digite sua mensagem...                 ] [📎] [  Enviar  ]  │
└──────────────────────────────────────────────────────────────────┘
```

### Realtime de mensagens

```typescript
// hook useConversaRealtime(conversaId)
useEffect(() => {
  const channel = supabase
    .channel(`conversa-${conversaId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'mensagens',
      filter: `conversa_id=eq.${conversaId}`
    }, (payload) => {
      // Adicionar mensagem ao estado local sem re-fetch
      setMensagens(prev => [...prev, payload.new]);
      // Scroll automático para o final
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    })
    .subscribe();

  return () => { supabase.removeChannel(channel) };
}, [conversaId]);
```

### Badge no menu lateral

```typescript
// hook useMensagensNaoLidas()
// Subscreve ao canal 'mensagens-{userId}' via Realtime
// Retorna: { total: number, porConversa: Record<number, number> }
// Exibir badge com número no item "Mensagens" do sidebar
```

═══════════════════════════════════════════════════════════════════
PARTE 5 — SCORE DE RISCO INTERNO
═══════════════════════════════════════════════════════════════════

## 5.1 — ScoreRiscoService

Calcular e atualizar o score após cada evento:

```typescript
async recalcularScore(clientId: number) {
  const [loans, parcelas] = await Promise.all([
    this.prisma.loan.findMany({ where: { clientId } }),
    this.prisma.installment.findMany({
      where: { loan: { clientId } }
    })
  ]);

  const totalEmprestimos   = loans.length;
  const totalQuitados      = loans.filter(l => l.status === 'quitado').length;
  const totalReparcelamentos = loans.reduce((acc, l) => acc + l.reparcelamentoCount, 0);
  const totalAtrasadas     = parcelas.filter(p => p.status === 'atrasado').length;
  const totalPagas         = parcelas.filter(p => p.status === 'pago').length;

  // Fórmulas (escala 0-100):
  const scorePontualidade = totalPagas > 0
    ? Math.max(0, 100 - (totalAtrasadas / (totalPagas + totalAtrasadas)) * 100)
    : 100;

  const scoreReparcelamentos = Math.max(0, 100 - (totalReparcelamentos * 15));
  // -15 pontos por reparcelamento

  const scoreQuitacoes = totalEmprestimos > 0
    ? (totalQuitados / totalEmprestimos) * 100
    : 50;

  const scoreGeral = Math.round(
    scorePontualidade * 0.5 +
    scoreReparcelamentos * 0.3 +
    scoreQuitacoes * 0.2
  );

  const classificacao =
    scoreGeral >= 85 ? 'excelente' :
    scoreGeral >= 70 ? 'bom' :
    scoreGeral >= 50 ? 'regular' : 'alto_risco';

  await this.prisma.scoreRisco.upsert({
    where: { clientId },
    create: { clientId, scorePontualidade, scoreReparcelamentos,
              scoreQuitacoes, scoreGeral, classificacao,
              totalEmprestimos, totalQuitados, totalReparcelamentos,
              totalParcelasAtrasadas: totalAtrasadas },
    update: { scorePontualidade, scoreReparcelamentos,
              scoreQuitacoes, scoreGeral, classificacao,
              totalEmprestimos, totalQuitados, totalReparcelamentos,
              totalParcelasAtrasadas: totalAtrasadas,
              calculadoEm: new Date() },
  });
}
```

## 5.2 — Exibir score no painel de análise da intenção

No frontend, na tela do financeiro ao analisar uma intenção, exibir:

```
┌──────────────────────────────────────────────────────┐
│  Score de risco — João da Silva                      │
├──────────────────────────────────────────────────────┤
│  Score geral:  78/100   [ Bom ] ██████████░░░░        │
│  Pontualidade: 85/100   ████████████░░░               │
│  Reparcelamentos: 85/100  ████████████░░░             │
│  Histórico de quitações: 50/100  ███████░░░░░         │
├──────────────────────────────────────────────────────┤
│  3 contratos | 1 quitado | 0 reparcelamentos         │
│  2 parcelas atrasadas no histórico                   │
└──────────────────────────────────────────────────────┘
```

═══════════════════════════════════════════════════════════════════
PARTE 6 — SIMULADOR DE REPARCELAMENTO (Frontend — Financeiro)
═══════════════════════════════════════════════════════════════════

Na tela de análise da SolicitacaoReparcelamento, implementar simulador
interativo ANTES de o financeiro confirmar os termos:

```typescript
// Campos editáveis pelo financeiro:
// - Novo principal (pre-filled: saldo devedor atual)
// - Novo lucro alvo (target_profit)
// - Número de parcelas
// - Data de início

// Simulação ao vivo (usando decimal.js):
const saldoDevedor      = new Decimal(loan.saldoDevedor);
const diasAtraso        = calcularDiasAtraso(loan);
const multa             = saldoDevedor.times(settings.multaPerc).dividedBy(100);
const mora              = saldoDevedor.times(settings.moraPerc).dividedBy(100).times(diasAtraso);
const totalEncargos     = multa.plus(mora);
const totalAReceber     = novoPrincipal.plus(novoLucro);
const valorParcela      = totalAReceber.dividedBy(novasParcelas);

// Exibir em tempo real:
// Saldo devedor atual: R$ {saldoDevedor}
// Multa (2%):          R$ {multa}
// Mora ({n} dias):     R$ {mora}
// Total encargos:      R$ {totalEncargos}
// ──────────────────────────────
// Novo total a receber: R$ {totalAReceber}
// Valor de cada parcela: R$ {valorParcela}
// Net gain total:        R$ {novoLucro}
```

═══════════════════════════════════════════════════════════════════
ENTREGÁVEIS — ORDEM DE EXECUÇÃO
═══════════════════════════════════════════════════════════════════

Implemente nesta ordem. Aguarde confirmação após cada grupo.

GRUPO A — Schema
  1. Todas as migrations das Partes 1.1 a 1.6
  2. Seed das configurações financeiras em site_settings
  3. Adicionar tabelas ao supabase_realtime publication:
     mensagens (INSERT), solicitacoes_reparcelamento (UPDATE)

GRUPO B — Score e configurações
  4. ScoreRiscoService.recalcularScore()
  5. Hook: recalcular após pagamento, quitação, atraso, reparcelamento
  6. SettingsService: helper para get/set de site_settings com cache

GRUPO C — Fluxo de intenção completo
  7. IntencaoService: criar (com SLA + Conversa automática)
  8. IntencaoService: aprovar (ativar portal automaticamente)
  9. IntencaoService: rejeitar (com motivos predefinidos)
  10. IntencaoService: registrarFeedback
  11. CronService: verificarSlaIntencoes
  12. Frontend: painel do financeiro com score de risco
  13. Frontend: feedback do consultor com seleção de canal

GRUPO D — Fluxo de reparcelamento
  14. SolicitacaoReparcelamentoService completo
  15. FinanceiroService: proporTermos com cálculo de multa/mora
  16. FinanceiroService: confirmarSegundaInstancia
  17. FinanceiroService: executarReparcelamento com $transaction
  18. Portal cliente: solicitarReparcelamento + aceitarTermos
  19. CronService: lembrete de dataPrevistaPagamento (D-1 e D+1)
  20. Frontend financeiro: simulador interativo

GRUPO E — Comunicador interno
  21. Models Mensagem + Conversa + ConversaParticipante (já na migration do Grupo A)
  22. MensagemService completo com upload de documentos
  23. MensagemController com todos os endpoints
  24. Bucket 'mensagens-docs' no Supabase Storage + políticas RLS
  25. Frontend: tela /mensagens (lista + conversa aberta + input)
  26. Hook useConversaRealtime + badge useMensagensNaoLidas
  27. Integração automática: criar Conversa de contexto ao criar intenção
      e ao criar solicitação de reparcelamento

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS INVIOLÁVEIS
═══════════════════════════════════════════════════════════════════

- $transaction obrigatório no executarReparcelamento (cancelamento +
  criação do novo loan deve ser atômica — ou ambos ocorrem ou nenhum)
- Snapshot do contrato original ANTES de cancelar — nunca depois
- Segunda instância obrigatória para executar reparcelamento
- Score calculado sempre após eventos financeiros — nunca stale
- decimal.js em todo cálculo de multa, mora e split de parcela
- Cliente NÃO pode abrir conversa direta com financeiro
- Bucket 'mensagens-docs': privado, 10MB, apenas PDF/JPEG/PNG/WEBP
- origemLoanId com @unique — um contrato cancelado gera exatamente 1 novo
- Aceite digital gravado com timestamp + IP + hash SHA-256
- AuditLog com snapshot em: INTENCAO_APROVADA, INTENCAO_REJEITADA,
  REPARCELAMENTO_EXECUTADO, ACEITE_REPARCELAMENTO_CLIENTE
- Realtime cleanup no return de todo useEffect com supabase.removeChannel()
```
