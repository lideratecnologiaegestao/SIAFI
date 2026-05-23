# SIAFI 2.0 — Fluxograma de Empréstimos

> Última atualização: 2026-05-22

Este documento descreve o ciclo de vida completo de um contrato de empréstimo no SIAFI, da intenção inicial até a quitação ou cancelamento.

---

## Fluxo Interativo (HTML)

<iframe src="../siafi_fluxograma.html" width="100%" height="800px" style="border: 1px solid #ddd; border-radius: 8px; margin-bottom: 24px;"></iframe>

[Abrir fluxograma interativo em tela cheia](../siafi_fluxograma.html){:target="_blank"}

---



## Legenda de Status

| Status do Loan | Cor | Descrição |
|----------------|-----|-----------|
| `aguardando_aceite` | 🟡 Amarelo | Criado, aguardando assinatura do cliente |
| `aguardando_liberacao` | 🔵 Azul | Aceito, aguardando entrega do capital |
| `ativo` | 🟢 Verde | Em andamento |
| `quitado` | 🟩 Verde escuro | Todas as parcelas pagas |
| `cancelado` | 🔴 Vermelho | SLA vencido ou cancelamento manual |

| Status da Parcela | Descrição |
|-------------------|-----------|
| `pendente` | Ainda não venceu |
| `atrasado` | Vencida sem pagamento |
| `parcialmente_pago` | Parte do valor foi pago |
| `pago` | Quitada integralmente |
| `cancelado` | Loan cancelado antes do vencimento |

---

## Etapas Detalhadas

### 1. Intenção de Empréstimo
- **Quem:** Consultor (ou Admin/Financeiro diretamente)
- **SLA:** 48h para análise (configurável em Configurações)
- **Cron `sla-intencoes`:** verifica a cada 2h — alerta se próxima do vencimento
- **Aprovação:** cria contrato automaticamente + ativa portal do cliente (se configurado)
- **Rejeição:** fecha com motivo registrado
- **Expiração:** status vai para `expirado`, consultor notificado

### 2. SLA de Aceite
- **Prazo:** N dias (padrão: 5 dias, configurável)
- **Cron `sla-aceite`** (07h00):
  - D-2: envia alerta ao cliente por email + WhatsApp
  - D-1: envia alerta ao consultor
  - D+0: cancela loan + parcelas + reverte intenção para `aprovado`
- **Aceite digital:** cliente assina no portal → hash SHA-256 gravado no loan

### 3. Liberação de Capital
- **Quem:** Caixa, Financeiro ou Admin
- **Ação:** `PATCH /loans/:id/liberar-capital`
- **Efeitos automáticos:**
  - Status → `ativo`
  - Datas das parcelas recalculadas a partir da data de liberação
  - Transação de saída registrada no caixa
  - Cliente notificado

### 4. Cobrança Antecipada (Cron 09h30)
- **Critério:** parcela vencendo em N dias (padrão: 10 dias por contrato)
- **Execução:**
  1. `CobrancaService.processarCobrancasAntecipadas()`
  2. Gera PDF boleto via PDFKit → upload no Supabase Storage (`boletos-cobranca`)
  3. Enfileira jobs: `whatsapp.cobranca-antecipada` + `email.cobranca-antecipada` (PDF em anexo)
  4. Marca `cobrancaEnviadaEm` na parcela

### 5. Vencimento e Encargos
- **Cron `mark-overdue`** (08h00): parcelas vencidas → `atrasado`
- **Cron `atualizar-encargos`** (08h05):
  - Multa: aplicada **uma vez** quando a parcela entra em atraso (`multaAplicada`)
  - Mora: calculada **diariamente** sobre o `saldoDevedor` (`moraAcumulada += saldoDevedor × taxaMoraDiaria`)
- **Configuração:** por contrato (`multaPercentual`, `moraDiariaPercentual`) ou global (SiteSetting)

### 6. Pagamento
- **Integral:** parcela → `pago`; se última → loan → `quitado`
- **Parcial:** parcela → `parcialmente_pago`; `saldoDevedor` reduzido; mora continua
- **Score de risco:** recalculado automaticamente (fire-and-forget) após qualquer pagamento

### 7. Reparcelamento
- **Execução atômica** via `Prisma.$transaction`:
  1. Loan original → `cancelado`
  2. Parcelas pendentes → `cancelado`
  3. Novo loan criado com `origemLoanId` e `reparcelamentoCount + 1`
  4. `aceiteClienteHash` registrado
  5. `SolicitacaoReparcelamento` → `executado`
  6. Score recalculado (penaliza)

---

## Crons Relacionados ao Ciclo

```
02h00  conciliacao-pix          → Verifica PIX pendentes no Mercado Pago
07h00  sla-aceite               → Alertas D-2/D-1; cancela vencidos
08h00  mark-overdue             → Parcelas → atrasado
08h05  atualizar-encargos       → Multa (1x) + mora diária
09h00  send-reminders           → Lembretes de vencimento próximo
09h30  cobrancas-antecipadas    → PDF + WhatsApp + Email
10h00  send-overdue             → Notifica inadimplentes
11h00  lembrete-reparcelamentos → Cobranças pendentes de reparcelamento
14h00  reenviar-cobrancas       → Reenvio não-lidas no portal
*/2h   sla-intencoes            → Monitora SLA de intenções
```

---

## Regras de Negócio Importantes

1. **Decimal.js obrigatório** em todos os cálculos financeiros — precisão 20, ROUND_HALF_UP
2. **Campos internos nunca expostos ao portal:** `principalPayback`, `netGain`, `valorInvestido`
3. **Score de risco sempre fire-and-forget** — nunca propaga erro para o fluxo principal
4. **Reparcelamento é atômico** — se qualquer etapa falhar, nada é confirmado
5. **Aceite digital é imutável** — o hash SHA-256 é gerado na assinatura e nunca alterado
6. **Liberação de capital recalcula datas** — as parcelas usam a data real de entrega do capital
7. **Multa aplicada apenas uma vez** — mora continua acumulando diariamente até quitação
8. **Soft-delete em tudo** — clientes e usuários nunca são excluídos fisicamente
