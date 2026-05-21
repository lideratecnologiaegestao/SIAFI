# SIAFI 2.0 — Manual do Usuário Operador

> **Sistema Integrado de Apoio Financeiro — Lidera**
> Versão 2.0 · Maio 2026

---

## Acesso ao Sistema

**URL:** https://financeiro.lidera.app.br

### Login
1. Informe o **usuário** (username ou e-mail) e a **senha**
2. Clique em **Entrar**
3. Se MFA estiver ativado, informe o código TOTP do autenticador

### Configurar Autenticação em Dois Fatores (MFA)
1. Acesse o menu superior → **MFA Setup**
2. Escaneie o QR Code com Google Authenticator ou Authy
3. Digite o código de 6 dígitos para confirmar
4. Guarde os códigos de recuperação em local seguro

> ⚠️ Após ativar o MFA, ele será exigido a cada login.

---

## Perfis de Acesso

| Perfil | O que pode fazer |
|--------|-----------------|
| **Admin** | Tudo — configurações, usuários, auditoria, exclusão de dados |
| **Financeiro** | Clientes, contratos, pagamentos, relatórios, reparcelamentos, intenções |
| **Caixa** | Registrar pagamentos, caixa, visualizar clientes e parcelas |
| **Consultor** | Carteira própria, criar intenções e clientes, acompanhar reparcelamentos |
| **Cliente** | Somente portal próprio — ver contratos, parcelas, pagar via PIX |

---

## Dashboard

Exibe em tempo real:
- **Clientes Ativos** — total de clientes com status ativo
- **Empréstimos Ativos** — valor em carteira + valor a faturar
- **Clientes Atrasados** — clientes com parcelas em atraso
- **Clientes Quitados** — clientes que já quitaram empréstimos

Clique em qualquer card para navegar à lista correspondente.

---

## Clientes

### Listagem
- Busca por nome, CPF ou WhatsApp
- Filtro por status (Ativo / Inativo)
- Coluna **Consultor** — clientes sem consultor mostram botão "Vincular" (admin/financeiro)
- Coluna **Portal** — indica se o acesso ao portal está ativo

### Cadastrar Novo Cliente
1. Clique em **Novo Cliente**
2. Preencha os dados pessoais (nome e WhatsApp são obrigatórios)
3. Se for admin/financeiro: selecione o **Consultor responsável** (opcional)
4. Faça upload dos documentos (foto, RG, comprovante)
5. Clique em **Salvar Cliente**

> Consultores: ao criar um cliente, ele é automaticamente vinculado à sua carteira.

### Detalhe do Cliente
Exibe:
- Dados pessoais, contatos, endereço
- **Consultor vinculado** — com botão "Alterar" (admin/financeiro)
- Documentos (links com expiração de 1h)
- **Portal do Cliente** — status, MFA, último acesso, reenvio de senha
- Score de Risco (0–100)
- Histórico de contratos

### Vincular Consultor
- Na listagem: clique em **Vincular** na coluna Consultor
- No detalhe: clique em **Alterar** no card Consultor
- Selecione o consultor no dropdown e confirme

### Portal do Cliente (card na página de detalhe)
- **Ativar portal**: cria conta no Supabase, envia senha temporária por email e WhatsApp
- **Reenviar senha**: gera nova senha temporária e envia por email e WhatsApp
- **Desativar/Reativar**: bloqueia ou desbloqueia o acesso
- O aviso "⚠️ Cliente ainda não trocou a senha temporária" aparece enquanto `senhaTemporaria=true`

---

## Empréstimos (Contratos)

### Fluxo Completo do Contrato

```
Intenção criada → Aprovada → Contrato gerado (aguardando_aceite)
                                      ↓
                          Cliente assina no portal (N dias)
                                      ↓
                          Caixa/Financeiro confirma entrega (aguardando_liberacao)
                                      ↓
                          Contrato ATIVO — parcelas com datas atualizadas
                                      ↓
                          Parcelas pagas → QUITADO
```

### Criar Empréstimo
1. Acesse **Empréstimos → Novo Empréstimo**
2. Selecione o cliente
3. Informe o valor total, valor da parcela (ou taxa de juros), número de parcelas
4. Defina a data de início e, opcionalmente, o **dia fixo de vencimento** (1–28)
5. Configure as opções de cobrança:
   - Multa por atraso (% — aplicada uma vez)
   - Mora diária (% ao dia sobre saldo devedor)
   - Dias de antecedência para cobrança antecipada
   - Canais: WhatsApp, Email, Portal
6. Clique em **Criar Empréstimo**

> O simulador inline mostra a prévia de multa e mora acumulada.

### Status do Contrato

| Status | Descrição |
|--------|-----------|
| `Aguardando aceite` | Cliente precisa assinar no portal |
| `Aguardando liberação` | Capital precisa ser confirmado |
| `Ativo` | Em andamento |
| `Quitado` | Todas as parcelas pagas |
| `Cancelado` | Cancelado por SLA ou manualmente |

### Liberar Capital
1. No detalhe do empréstimo com status "Aguardando liberação"
2. Clique em **Confirmar Entrega de Capital**
3. Selecione o método de liberação (PIX, dinheiro, transferência, etc.)
4. Uma saída é registrada automaticamente no caixa

### Cancelar Empréstimo
- Apenas contratos em `aguardando_aceite` ou `aguardando_liberacao` podem ser cancelados
- Todas as parcelas pendentes são marcadas como `cancelado`

### Aba Cobranças (no detalhe)
Exibe por parcela:
- Data de envio da cobrança antecipada
- Confirmação por canal (WhatsApp ✅ / Email ✅ / Portal ✅)
- Multa aplicada e valor com encargos

---

## Parcelas

### Listagem de Parcelas em Atraso
- Acesse **Parcelas** no menu lateral
- Exibe todas as parcelas com status `atrasado`
- Mostra saldo devedor, mora acumulada e multa aplicada

### Pagamento Parcial
Quando um cliente paga menos do que o valor integral:
- Status da parcela vai para `parcialmente_pago`
- **Saldo devedor** fica registrado na parcela
- **Mora diária** é calculada sobre o saldo (cron 08h05)
- Próximo pagamento pode quitar o saldo restante

---

## Pagamentos

### Registrar Pagamento
1. Acesse **Pagamentos → Novo Pagamento**
2. Selecione o cliente → o empréstimo → a parcela
3. Informe o valor e a data de pagamento
4. Clique em **Registrar**

> O sistema calcula automaticamente se é pagamento total ou parcial.

### Estornar Pagamento
1. Acesse **Pagamentos** → localize o pagamento
2. Clique em **Estornar**
3. Confirme o estorno

> O estorno recalcula o saldo devedor e o status da parcela.

---

## Caixa

Exibe o saldo atual e o histórico de transações.

### Lançamento Manual
1. Clique em **Novo Lançamento**
2. Selecione Entrada ou Saída
3. Informe o valor, descrição e referência (opcional)

> Liberações de capital e estornos geram transações automaticamente.

---

## Inadimplentes

Lista clientes com parcelas em atraso, com:
- Nome e contato
- Quantidade de parcelas atrasadas
- Valor total em atraso
- Score de risco

---

## Intenções de Empréstimo

Consultores criam intenções antes de gerar o contrato formal.

### Criar Intenção
1. Acesse **Intenções → Nova Intenção**
2. Selecione o cliente, informe o valor solicitado e a finalidade
3. Clique em **Enviar**

### Analisar Intenção (Financeiro/Admin)
- A intenção fica com status `pendente` até a análise
- **SLA:** 48h por padrão (configurável em Configurações)
- Clique em **Aprovar** → o contrato é criado automaticamente
- Clique em **Rejeitar** → intenção encerrada com motivo
- **Feedback** → comentário sem decisão

> Se o cliente não tem portal ativo, a aprovação pode ativá-lo automaticamente.

---

## Reparcelamento

Permite reestruturar um contrato ativo com novo prazo e valor.

### Solicitar Reparcelamento
1. Acesse **Reparcelamentos → Novo Reparcelamento**
2. Selecione o contrato
3. Informe o motivo e use o **simulador** para visualizar as novas parcelas
4. Envie a solicitação

### Fluxo de Aprovação

```
Solicitado
    → Financeiro envia proposta (novos valores)
    → Admin aprova (2ª instância)
    → Executado atomicamente:
        ✓ Loan original cancelado
        ✓ Parcelas não pagas canceladas
        ✓ Novo loan criado com nova configuração
        ✓ Score de risco recalculado
```

---

## Score de Risco

Pontuação 0–100 calculada automaticamente após cada pagamento.

| Score | Classificação |
|-------|--------------|
| 80–100 | Excelente |
| 60–79 | Bom |
| 40–59 | Médio |
| 0–39 | Alto risco |

**Componentes:**
- Pontualidade (50%): proporção de parcelas pagas no prazo
- Reparcelamentos (30%): penaliza histórico de reparcelamentos
- Quitações (20%): bonifica contratos quitados

---

## Relatórios

Acesse **Relatórios** no menu lateral. Cinco abas:

| Aba | Conteúdo |
|-----|----------|
| **Carteira** | Valor investido, a receber, capital em risco, totais |
| **Faturamento** | Faturamento mensal por consultor |
| **Clientes** | Clientes ativos com próxima parcela e score |
| **Movimentação** | Entradas e saídas por período |
| **Contratos** | Lista filtrada de contratos |

---

## Mensagens (Chat Interno)

Chat entre operadores com notificação em tempo real.

- Badge com contagem de não-lidas aparece no menu lateral
- Novas mensagens chegam instantaneamente via Supabase Realtime
- Conversas são por pares de usuários (direto)

---

## PIX

1. Acesse **PIX** no menu lateral
2. Selecione a parcela
3. Clique em **Gerar QR Code**
4. O QR Code é enviado ao cliente e aparece na tela

> Pagamentos via Mercado Pago são processados automaticamente via webhook.

---

## Conciliação

Comparativo entre pagamentos registrados no sistema e recebimentos via Mercado Pago.

---

## Notificações

Log de todos os emails e WhatsApp enviados pelo sistema, com status de entrega.

---

## Auditoria (Admin)

Log completo de todas as ações do sistema.

- **Filtro por ação:** `EMAIL_ENVIADO`, `EMAIL_FALHOU`, `PORTAL_ATIVADO`, `LOGIN`, etc.
- **Filtro por entidade:** `client`, `loan`, `email`, `payment`
- **Detalhe expandível:** clique na linha para ver destinatário, erro SMTP, messageId, etc.

**Ações de email registradas:**
| Ação | Significado |
|------|------------|
| `EMAIL_ENVIADO` | Email entregue com sucesso |
| `EMAIL_FALHOU` | Erro SMTP — detalhe na linha expandida |
| `EMAIL_IGNORADO` | Cliente sem email cadastrado |

---

## Configurações (Admin)

Parâmetros do sistema ajustáveis sem código:

| Parâmetro | Padrão | Descrição |
|-----------|--------|-----------|
| Taxa de mora diária | 0,1% ao dia | Aplicada sobre saldo devedor |
| Taxa de multa | 2% | Aplicada uma vez no atraso |
| SLA aceite contrato | 5 dias | Prazo para cliente assinar |
| SLA intenção | 48 horas | Prazo para financeiro analisar |
| Dias antecedência cobrança | 10 dias | Cobrança antecipada antes do vencimento |

---

## Usuários (Admin)

### Criar Operador
1. Acesse **Usuários → Novo Usuário**
2. Informe nome, username, email e senha provisória
3. Selecione o perfil (admin, financeiro, caixa, consultor)
4. O usuário recebe acesso imediato

### Editar/Inativar
- Clique no usuário → **Editar**
- Para inativar: desmarque "Ativo" ou use o botão Desativar

---

## Perguntas Frequentes

**O cliente não recebeu o email com a senha?**
1. Acesse /auditoria e filtre por `EMAIL_FALHOU` ou `EMAIL_IGNORADO`
2. Se `EMAIL_IGNORADO`: o cliente não tem email cadastrado — atualize o cadastro
3. Se `EMAIL_FALHOU`: veja o erro SMTP na linha expandida
4. Clique em **Reenviar senha** no card Portal do cliente

**Como saber se o email foi entregue?**
- Acesse /auditoria e filtre por `EMAIL_ENVIADO`
- A linha expandida mostra `messageId` confirmado pelo servidor SMTP

**Como liberar um contrato já assinado pelo cliente?**
- Acesse o contrato com status "Aguardando liberação"
- Clique em **Confirmar Entrega de Capital**

**O contrato aparece como "Aguardando aceite" mas o prazo venceu?**
- O cron de 07h cancela automaticamente contratos com SLA vencido
- O consultor é notificado com 1 dia de antecedência

**Como recalcular o score de risco de um cliente?**
- Acesse o detalhe do cliente → card Score de Risco → **Recalcular**
- Ou registre um pagamento — o score é recalculado automaticamente

**Como reverter um pagamento registrado errado?**
- Acesse **Pagamentos** → localize o pagamento → **Estornar**
- O saldo devedor e o status da parcela são revertidos automaticamente

**Um cliente quer excluir seus dados (LGPD)?**
- Inative o cliente (soft-delete)
- Dados financeiros são retidos por 5 anos (obrigação legal)
- Documentos pessoais (fotos/RG) podem ser excluídos manualmente do Supabase Storage
- Registre a solicitação para fins de auditoria
