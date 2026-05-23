
```
Você é um Engenheiro de Software Sênior e Designer de UX especializado
em sistemas financeiros. Analise toda a documentação do SIAFI 2.0 e
todos os fluxos de negócio já definidos.

Sua missão é remontar as telas, menus, formulários e dashboards de
cada perfil operacional para que estejam em perfeita conformidade
com os fluxos implementados — sem telas desnecessárias, sem campos
faltando, sem ações que o perfil não deveria ter.

PROTOCOLO OBRIGATÓRIO: antes de implementar cada perfil, apresente
um PLANEJAMENTO DETALHADO para minha aprovação. Só implemente após
eu confirmar. Siga a ordem: Consultor → Financeiro → Caixa → Admin.

═══════════════════════════════════════════════════════════════════
CONTEXTO DO SISTEMA
═══════════════════════════════════════════════════════════════════

O SIAFI é um sistema financeiro de factoring e empréstimos com os
seguintes fluxos já implementados e documentados:

FLUXO PRINCIPAL:
  Consultor cadastra cliente → registra intenção de empréstimo →
  Financeiro aprova/rejeita (com SLA de 24h) →
  Se aprovado: contrato gerado com split (principal_payback + net_gain)
             + portal do cliente ativado automaticamente →
  Cliente assina digitalmente (SLA de 7 dias) →
  Caixa confirma entrega do capital (dinheiro/PIX/TED) →
  Parcelas geradas com dia fixo de vencimento →
  Cobrança antecipada automática X dias antes (WhatsApp + email + portal) →
  Cliente paga → Split registrado no caixa →
  Se não pagar: parcela vira atrasado → mora diária sobre saldo devedor →
  Cliente pode solicitar reparcelamento via portal →
  Financeiro define novos termos → 2ª instância aprova →
  Contrato original cancelado + novo contrato criado.

MÓDULOS ATIVOS:
  - ConsultorModule: carteira, intenções, solicitações, cobranças
  - IntencaoEmprestimo: aguardando → aprovado/rejeitado → convertido
  - SolicitacaoReparcelamento: pendente → em_analise → aprovado/executado
  - Comunicador interno: conversas com contexto vinculado
  - Split de parcela: principal_payback + net_gain por parcela
  - Cobrança antecipada: diasAntecedenciaCobranca por contrato
  - Encargos individuais: multaPercentual + moraDiariaPercentual por contrato
  - LoanStatus: aguardando_aceite → aguardando_liberacao → ativo → quitado
  - EmailTemplates: painel de controle de emails no admin

ROLES ATIVOS (sem 'usuario'):
  admin | financeiro | consultor | caixa | cliente

═══════════════════════════════════════════════════════════════════
INSTRUÇÕES PARA O PLANEJAMENTO DE CADA PERFIL
═══════════════════════════════════════════════════════════════════

Para cada perfil, antes de implementar, apresente:

1. ANÁLISE DO ESTADO ATUAL
   - O que o perfil tem hoje (menus, telas, formulários)
   - O que está sobrando (telas sem uso no novo fluxo)
   - O que está faltando (telas novas necessárias para o fluxo)
   - O que precisa ser reformulado (campos, formulários desatualizados)

2. MAPA DE NAVEGAÇÃO PROPOSTO
   - Árvore completa de rotas que este perfil terá acesso
   - Itens do menu lateral organizados por grupo
   - Indicar: [NOVO] [REFORMULADO] [REMOVIDO] [MANTIDO]

3. DASHBOARD PROPOSTO
   - KPIs específicos do perfil
   - Listas de ações pendentes (o que o perfil precisa fazer agora)
   - Alertas e urgências

4. FORMULÁRIOS CRÍTICOS
   - Listar todos os formulários com campos exatos
   - Indicar validações obrigatórias
   - Indicar campos calculados automaticamente
   - Indicar campos que dependem de outros

5. TELAS A REMOVER
   - Justificar por que cada tela removida não se aplica ao perfil

Aguarde confirmação antes de implementar.

═══════════════════════════════════════════════════════════════════
PERFIL 1 — CONSULTOR
═══════════════════════════════════════════════════════════════════

## Contexto do consultor no fluxo

O consultor é o ponto de entrada do negócio. Ele:
- Prospecta e cadastra clientes (sua carteira pessoal)
- Colhe documentação e registra intenção de empréstimo
- Acompanha a análise do financeiro
- Informa o cliente sobre aprovação ou rejeição
- Após aprovação: acompanha o portal do cliente, gera cobranças,
  registra contatos de cobrança, envia WhatsApp/PIX
- Solicita descontos ou reparcelamentos ao financeiro
- Usa o comunicador interno para se comunicar com financeiro e admin

## O que o consultor NÃO faz (remover ou ocultar):

- NÃO cria empréstimos diretamente (apenas intenções)
- NÃO acessa caixa nem fluxo de caixa global
- NÃO faz renegociações (solicita ao financeiro)
- NÃO vê clientes de outros consultores
- NÃO acessa relatórios financeiros globais
- NÃO acessa configurações do sistema
- NÃO gerencia usuários
- NÃO vê auditoria global
- NÃO acessa conciliação bancária

## Telas que o consultor precisa (novo mapa):

```
MENU DO CONSULTOR:
├── 🏠 Início (Dashboard da carteira)
│
├── 👥 Minha Carteira
│   ├── Lista de clientes (filtra por consultorId)
│   ├── Cadastrar novo cliente      [REFORMULADO]
│   ├── Detalhe do cliente          [REFORMULADO]
│   └── Editar cliente
│
├── 📋 Intenções de Empréstimo      [NOVO]
│   ├── Lista de intenções (status: aguardando/aprovado/rejeitado)
│   ├── Nova intenção               [NOVO]
│   └── Detalhe da intenção         [NOVO]
│
├── 💬 Solicitações ao Financeiro   [NOVO]
│   ├── Lista de solicitações
│   └── Nova solicitação (desconto, reparcelamento)
│
├── ⚠️ Cobranças                    [NOVO]
│   ├── Parcelas atrasadas da carteira
│   └── Registrar contato de cobrança
│
├── 💰 PIX / Boleto                 [REFORMULADO]
│   └── Gerar para clientes da carteira
│
├── 📊 Relatórios da Carteira       [NOVO]
│   └── Faturamento e inadimplência da carteira
│
└── 💬 Mensagens                    [NOVO]
    └── Comunicador interno
```

## Formulários do consultor que precisam de especificação:

### F1 — Cadastrar novo cliente
Campos obrigatórios:
- Nome completo *
- CPF (com máscara — único) *
- Data de nascimento *
- WhatsApp (com máscara) *
- Email (validar formato)
- RG
- Telefone fixo
- Endereço completo (CEP com autocomplete → preencher cidade/estado)
- Upload de documentos: foto, RG frente/verso, comprovante renda
  (Supabase Storage — bucket client-documents)
- Observações
- Campo oculto: consultorId = ID do consultor logado (nunca exibir)
- Campo informativo (read-only): "Este cliente será vinculado à sua carteira"

Validações:
- CPF: formato + algoritmo de validação
- Não permitir duplicata de CPF
- Máximo 10MB por arquivo de documento
- Tipos aceitos: JPEG, PNG, PDF

### F2 — Nova intenção de empréstimo
Campos:
- Cliente: select filtrado pela carteira do consultor *
- Valor solicitado (R$) * — com formatação monetária
- Número de parcelas * (1-360)
- Finalidade do empréstimo * (select: Capital de giro, Consumo pessoal,
  Quitação de dívidas, Reforma, Veículo, Outro)
- Descrição complementar (textarea)
- Observações para o financeiro

Exibir ao lado (calculado, não editável):
- Valor estimado da parcela (baseado no lucro padrão configurado)
- Score de risco do cliente

### F3 — Registrar contato de cobrança
Campos:
- Canal: WhatsApp / Ligação / Presencial / Email *
- Resultado *:
  ○ Prometeu pagar em: [data]
  ○ Não atendeu / não encontrado
  ○ Número/email incorreto
  ○ Negou a dívida
  ○ Outro: [texto livre]
- Observação (textarea)
- Parcela relacionada (preenchida automaticamente pelo contexto)

### F4 — Nova solicitação ao financeiro
Campos:
- Tipo *: Desconto / Reparcelamento / Comunicado / Outro
- Cliente * (select da carteira)
- Contrato relacionado (select — opcional)
- Valor envolvido (R$) — se aplicável
- Descrição detalhada * (textarea)
- Urgência: Normal / Alta

## Dashboard do consultor:

```
Linha 1 — KPIs da carteira:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Meus Clientes│ │ Intenções    │ │ Em Atraso    │ │ Solicitações │
│     12       │ │ Aguardando:3 │ │      2       │ │ Pendentes: 1 │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Linha 2 — Ações pendentes (o que o consultor precisa fazer AGORA):
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ Ações necessárias                                            │
│ • Intenção #15 aprovada — informar João da Silva               │
│ • Intenção #12 rejeitada — informar Maria Souza               │
│ • 3 clientes com parcela vencendo em 3 dias                    │
│ • 2 clientes em atraso sem contato registrado nos últimos 7d  │
└─────────────────────────────────────────────────────────────────┘

Linha 3 — Cobranças urgentes:
Lista de parcelas atrasadas da carteira com:
Nome do cliente, dias de atraso, valor, botão "Registrar contato"

Linha 4 — Últimas mensagens não lidas (comunicador)
```

═══════════════════════════════════════════════════════════════════
PERFIL 2 — FINANCEIRO
═══════════════════════════════════════════════════════════════════

## Contexto do financeiro no fluxo

O financeiro é o analista e aprovador. Ele:
- Analisa intenções de empréstimo (principal função)
- Aprova ou rejeita com motivo
- Define termos de reparcelamento (com simulador)
- Aprova solicitações dos consultores
- Gerencia os contratos: confirma liberação de capital
- Visualiza inadimplência e carteira global
- Acessa relatórios financeiros completos
- Usa o comunicador com consultores, admin e caixa

## O que o financeiro NÃO faz:

- NÃO cria usuários operacionais
- NÃO acessa configurações do sistema
- NÃO acessa auditoria global
- NÃO tem carteira própria de clientes (vê todos)

## Telas do financeiro (novo mapa):

```
MENU DO FINANCEIRO:
├── 🏠 Dashboard financeiro
│
├── 📋 Intenções de Empréstimo      [NOVO — fila de análise]
│   ├── Fila de análise (status: aguardando)
│   ├── Histórico (aprovadas/rejeitadas)
│   └── Detalhe com score de risco + aprovar/rejeitar
│
├── ⏳ Liberações Pendentes         [NOVO]
│   └── Contratos aguardando confirmação de entrega de capital
│
├── 💬 Solicitações dos Consultores [NOVO]
│   ├── Pendentes (fila de análise)
│   ├── Histórico
│   └── Detalhe + aprovar/rejeitar + simulador de reparcelamento
│
├── 👥 Clientes                     [MANTIDO — acesso total]
│   ├── Lista geral
│   ├── Cadastrar / Editar
│   └── Detalhe + ativar portal
│
├── 📄 Contratos                    [REFORMULADO]
│   ├── Lista com todos os status (novo: aguardando_aceite, aguardando_liberacao)
│   ├── Novo contrato (acesso direto, sem intenção)
│   ├── Detalhe + split por parcela
│   └── Liberar capital [NOVO]
│
├── 💳 Parcelas e Pagamentos
│   ├── Parcelas em atraso (global)
│   ├── Histórico de pagamentos
│   └── Registrar pagamento manual
│
├── ⚠️ Inadimplentes               [MANTIDO]
│   └── Carteira inadimplente global
│
├── 🔄 Reparcelamentos              [REFORMULADO]
│   ├── Lista de renegociações (novo: solicitacoes_reparcelamento)
│   └── Simulador + executar
│
├── 💵 Caixa                        [MANTIDO]
│   ├── Saldo e movimentações
│   └── Lançamentos manuais
│
├── 📊 Relatórios                   [REFORMULADO]
│   ├── Aba: Carteira (principal_amount, target_profit, net_gain)
│   ├── Aba: Faturamento mensal (net_gain realizado x previsto)
│   ├── Aba: Inadimplência (aging: 1-30 / 31-60 / 61-90 / 90+)
│   ├── Aba: Clientes
│   └── Aba: Contratos
│
├── 📧 Cobranças                    [NOVO]
│   └── Histórico de cobranças enviadas + reenvio manual
│
├── 🔔 Notificações                 [MANTIDO]
│
└── 💬 Mensagens                    [NOVO]
    └── Comunicador interno
```

## Formulários críticos do financeiro:

### F1 — Análise de intenção de empréstimo
Exibir:
- Dados do cliente: nome, CPF, score de risco (visual com barras)
- Dados solicitados: valor, parcelas, finalidade
- Documentos do cliente (links para Supabase Storage)
- Histórico de contratos do cliente
- Histórico de cobranças e atrasos

Ações disponíveis:
- [ Aprovar ] → modal com: observação opcional + confirmar
- [ Rejeitar ] → modal com: motivo tipo (select predefinido) + motivo livre (obrigatório)
- [ Pedir mais informações ] → abre conversa no comunicador

Motivos de rejeição (select predefinido):
- Score de crédito baixo
- Documentação incompleta
- Renda insuficiente para o valor solicitado
- Limite de contratos atingido
- Cliente com histórico de inadimplência
- Outro (campo livre obrigatório)

### F2 — Confirmar liberação de capital [NOVO]
Campos:
- Contrato: exibido (read-only) — cliente, valor, parcelas
- Método de entrega *:
  ○ Dinheiro em espécie
  ○ PIX
  ○ TED / Transferência bancária
- Data de liberação * (padrão: hoje)
- Comprovante (upload opcional — PDF/imagem)
- Observação
- Aviso: "Esta ação iniciará a contagem das parcelas a partir da data informada."

### F3 — Simulador e termos de reparcelamento
Seção 1 — Situação atual (read-only):
- Saldo devedor atual
- Dias em atraso
- Multa calculada (X%)
- Mora acumulada (Y dias × Z%/dia)
- Total de encargos

Seção 2 — Novos termos (editável):
- Novo capital (principal_amount) *
- Novo lucro alvo (target_profit) *
- Número de parcelas *
- Data de início *
- Encargos a aplicar: Multa [✓] Mora [✓] (checkboxes)
- Observação para o cliente

Preview ao vivo (calculado em tempo real):
- Novo valor da parcela
- Total a receber
- Comparação antes/depois

### F4 — Novo contrato (criação direta)
Todos os campos do prompt SPLIT_PARCELA mais:
- Seção "Configurações de cobrança" do prompt COBRANCA_ANTECIPADA:
  * Dia fixo de vencimento (1-28)
  * Dias de antecedência para cobrança (padrão: 10)
  * Canais: WhatsApp / Email / Portal
  * Multa %
  * Mora % ao dia

## Dashboard do financeiro:

```
Linha 1 — KPIs globais:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Intenções    │ │ Lib.         │ │ Inadimpl.    │ │ Fat. do Mês  │
│ Aguardando:5 │ │ Pendentes: 2 │ │ R$ 12.400    │ │ R$ 8.640,00  │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

Linha 2 — Fila de análise (prioridade por SLA):
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Intenções aguardando análise                    [Ver todas →]│
│ ⚠️ #18 · João da Silva · R$5.000 · Vence SLA em 2h            │
│    #17 · Maria Costa  · R$2.000 · Vence SLA em 8h            │
│    #15 · Pedro Lima   · R$1.500 · Vence SLA em 14h           │
└─────────────────────────────────────────────────────────────────┘

Linha 3 — Liberações pendentes:
┌─────────────────────────────────────────────────────────────────┐
│ ⏳ Aguardando confirmação de entrega               [Ver todas →]│
│    Contrato #42 · R$2.000 · Aceite: 20/05 14:32               │
│    Contrato #43 · R$1.500 · Aceite: 20/05 16:10               │
└─────────────────────────────────────────────────────────────────┘

Linha 4 — Gráfico de aging (inadimplência por faixa):
Barras: 1-30 dias / 31-60 / 61-90 / 90+
```

═══════════════════════════════════════════════════════════════════
PERFIL 3 — CAIXA
═══════════════════════════════════════════════════════════════════

## Contexto do caixa no fluxo

O caixa é o executor financeiro do dia a dia. Ele:
- Confirma a entrega física do capital ao cliente
- Registra pagamentos recebidos (dinheiro, PIX, cartão)
- Gerencia o fluxo de caixa (entradas e saídas manuais)
- Consulta clientes para identificação (somente leitura)
- Confirma pagamentos de parcelas

## O que o caixa NÃO faz:

- NÃO cria clientes
- NÃO cria contratos nem intenções
- NÃO acessa relatórios gerenciais
- NÃO faz renegociações
- NÃO acessa comunicador geral
- NÃO vê split financeiro (principal_payback / net_gain)
- NÃO acessa configurações, usuários ou auditoria
- NÃO vê dados financeiros estratégicos da empresa

## Telas do caixa (novo mapa):

```
MENU DO CAIXA:
├── 🏠 Dashboard do caixa
│
├── ⏳ Liberar Capital              [NOVO — prioridade máxima]
│   └── Fila de contratos aguardando confirmação de entrega
│
├── 💳 Registrar Pagamento          [REFORMULADO]
│   ├── Busca rápida por CPF ou nome → seleciona parcela
│   └── Formulário simplificado de pagamento
│
├── 💵 Caixa                        [MANTIDO]
│   ├── Saldo do dia
│   ├── Movimentações do dia
│   └── Lançamento manual
│
├── 🔍 Consultar Cliente            [NOVO — leitura apenas]
│   └── Busca por CPF/nome → exibe contratos e parcelas (sem editar)
│
└── 📋 Parcelas do Dia              [NOVO]
    └── Parcelas com vencimento hoje + vencidas não pagas
```

## Formulários do caixa:

### F1 — Confirmar liberação de capital [IGUAL ao do financeiro]
Tela simples e direta:
- Card do contrato: cliente, valor, aceite em
- Método de entrega *
- Data de liberação * (padrão: hoje)
- Comprovante (upload)
- [ Confirmar entrega ]

### F2 — Registrar pagamento (fluxo otimizado para agilidade)
Passo 1: Identificar
- Campo único: CPF ou nome do cliente (auto-complete)
- Ao selecionar: exibir contratos ativos do cliente

Passo 2: Selecionar parcela
- Lista de parcelas pendentes/atrasadas/parcialmente_pagas
- Mostrar: número, vencimento, valor, saldo devedor, encargos (se atrasada)

Passo 3: Registrar
- Valor pago * (pré-preenchido com saldo devedor + encargos)
- Data do pagamento * (padrão: hoje)
- Método *: Dinheiro / PIX / Cartão / Cheque / Transferência
- Observação
- [ Confirmar pagamento ]

Regras:
- Mostrar claramente se há encargos (multa + mora) sobre o valor
- Permitir pagamento parcial com aviso visual
- Após confirmar: exibir recibo em tela com opção de imprimir

### F3 — Lançamento no caixa
Campos:
- Tipo *: Entrada / Saída
- Descrição * (texto livre)
- Categoria * (select: Operacional, Despesa, Outras)
- Valor * (R$)
- Data * (padrão: hoje)
- Comprovante (upload)

## Dashboard do caixa:

```
Foco total em operações do dia:

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Lib. Pendentes│ │ Pgtos Hoje   │ │ Saldo do Dia │
│      2       │ │      7       │ │ R$ 4.320,00  │
└──────────────┘ └──────────────┘ └──────────────┘

Liberações pendentes (vermelho se > 4h):
Lista de contratos aguardando entrega de capital

Parcelas vencendo hoje:
Lista com nome, valor, botão "Registrar pagamento"

Últimos pagamentos do dia (linha do tempo):
14:32 · João da Silva · R$ 280,00 · PIX
13:45 · Maria Costa  · R$ 500,00 · Dinheiro
```

═══════════════════════════════════════════════════════════════════
PERFIL 4 — ADMIN
═══════════════════════════════════════════════════════════════════

## Contexto do admin no fluxo

O admin tem acesso total. Além de todas as funções do financeiro, ele:
- Gerencia usuários (criar, editar, ativar/desativar)
- Define configurações do sistema
- Acessa auditoria completa
- Gerencia templates de email
- Define configurações financeiras globais (multa, mora, SLA, etc.)

## Telas do admin (acréscimo sobre o financeiro):

```
MENU DO ADMIN:
├── [tudo que o financeiro tem]
│
└── ⚙️ Administração
    ├── Usuários
    │   ├── Lista de operadores
    │   ├── Criar operador        [REFORMULADO — inclui role consultor]
    │   └── Editar operador
    │
    ├── Configurações             [REFORMULADO]
    │   ├── Empresa (nome, logo, CNPJ, contato)
    │   ├── Financeiro (multa global, mora global, SLA, limites)
    │   ├── WhatsApp (Evolution API)
    │   ├── Mercado Pago (tokens, webhook)
    │   └── SMTP (credenciais de email)
    │
    ├── Templates de Email        [NOVO — siafi-email-system]
    │   ├── Lista de templates
    │   └── Editor por tipo
    │
    └── Auditoria                 [MANTIDO]
        └── Log de ações do sistema
```

## Formulários críticos do admin:

### F1 — Criar/editar operador [REFORMULADO]
Campos:
- Nome completo *
- Username * (apenas letras, números, ponto, underline)
- Email * (usado no Supabase Auth e para login com Google)
- Senha inicial * (gerada automaticamente com botão "Gerar")
  (deixar em branco no edit para manter a atual)
- Perfil (role) *:
  ○ Administrador
  ○ Financeiro
  ○ Consultor    ← NOVO
  ○ Caixa
- Status: Ativo / Inativo
- MFA: exibir status (configurado / não configurado) — somente leitura

Aviso ao criar consultor:
"O perfil Consultor terá acesso apenas aos clientes que cadastrar.
 MFA será obrigatório no primeiro login."

### F2 — Configurações financeiras [NOVO]
Agrupado em cards:

Card "Encargos globais" (fallback para contratos sem configuração individual):
- Multa por atraso (%): input decimal com tooltip explicativo
- Mora diária (%/dia): input decimal
- Botão "Calcular equivalente mensal" → exibe X%/mês

Card "SLAs operacionais":
- SLA de análise de intenção (horas): padrão 24h
- SLA de escalonamento para admin (horas): padrão 48h
- SLA de aceite pelo cliente (dias): padrão 7 dias

Card "Limites":
- Máximo de reparcelamentos por contrato: padrão 3
- Máximo de contratos ativos por cliente: padrão 5
- Dias de antecedência para cobrança: padrão 10

═══════════════════════════════════════════════════════════════════
IMPLEMENTAÇÃO — COMO PROCEDER
═══════════════════════════════════════════════════════════════════

Para CADA perfil, siga exatamente esta ordem:

ETAPA 1 — PLANEJAMENTO (apresentar para aprovação):
  a. Análise do estado atual (o que tem hoje)
  b. Mapa de navegação com [NOVO][REFORMULADO][REMOVIDO][MANTIDO]
  c. Dashboard proposto com mockup textual
  d. Lista de formulários com campos exatos
  e. Telas a remover com justificativa
  → AGUARDAR CONFIRMAÇÃO

ETAPA 2 — BACKEND:
  a. Atualizar ROUTE_ROLES em (dashboard)/layout.tsx
  b. Atualizar sidebar.tsx com novos grupos e itens por role
  c. Novos endpoints necessários (se algum ainda não existe)

ETAPA 3 — FRONTEND — Dashboard:
  a. Dashboard específico do perfil
  b. KPIs com dados reais da API
  c. Seções de ações pendentes

ETAPA 4 — FRONTEND — Telas e formulários:
  a. Cada tela listada no mapa de navegação
  b. Formulários com validação (react-hook-form + zod)
  c. Estados vazios e loading skeletons

ETAPA 5 — VALIDAÇÃO:
  a. Testar que o perfil NÃO acessa rotas proibidas (403)
  b. Testar que formulários validam campos obrigatórios
  c. Testar que campos calculados funcionam em tempo real

═══════════════════════════════════════════════════════════════════
REGRAS TÉCNICAS INVIOLÁVEIS
═══════════════════════════════════════════════════════════════════

SEGURANÇA:
- Toda query do Consultor filtra por consultorId do JWT — sem exceção
- Caixa NÃO vê split (principal_payback / net_gain) — campos ocultos
- Caixa NÃO vê target_profit — apenas valorTotal da parcela
- Formulários validados no frontend (zod) E no backend (class-validator)
- Nenhum campo sensível financeiro exposto ao caixa via API

UX:
- Mobile first em todos os formulários (caixa usa tablet/celular)
- Estados de loading skeleton em toda listagem
- Estados vazios com mensagem e ação sugerida
- Feedback toast em toda ação de sucesso e erro
- Confirmação modal em ações destrutivas ou irreversíveis

FORMULÁRIOS:
- CPF com máscara ao digitar (formatCpfCnpj)
- Valores monetários com máscara R$ (decimal.js no cálculo)
- Datas com datepicker nativo + validação min/max
- Campos obrigatórios marcados com * na label
- Mensagens de erro inline abaixo de cada campo (não toast)
- Botão de submit desabilitado durante loading (evitar duplo clique)

FLUXO:
- Toda ação que muda status de contrato ou parcela:
  confirmação modal com resumo do que vai acontecer
- Aprovação/rejeição de intenção: sempre exige motivo
- Liberação de capital: sempre exige método de entrega
- Reparcelamento: sempre exige segunda instância de aprovação

CONSISTÊNCIA COM PROMPTS ANTERIORES:
- Nomenclatura: principal_amount, target_profit, net_gain,
  principal_payback, installment_amount (não usar nomes antigos)
- LoanStatus: aguardando_aceite, aguardando_liberacao, ativo, quitado
- InstallmentStatus: pendente, parcialmente_pago, pago, atrasado, cancelado
- Sempre usar decimal.js para cálculos de preview em tempo real
```
