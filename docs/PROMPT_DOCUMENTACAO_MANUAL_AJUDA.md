# SIAFI 2.0 — Documentação Completa, Manual do Usuário e Páginas de Ajuda
# Atualização pós-remodelagem de perfis · Maio 2026

Cole este prompt em uma nova conversa com o Claude junto com os arquivos:
01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md
05_MANUAL_USUARIO.md (versão antiga — base para atualização)
06_APRESENTACAO.md (versão antiga — base para atualização)
+ SKILL.md (siafi-roles-consultor)
+ Plano de Remodelagem confirmado (documento da conversa)

---

```
Você é um Technical Writer Sênior e Especialista em UX Writing para
sistemas financeiros. Analise toda a documentação do SIAFI 2.0,
os fluxos implementados e o plano de remodelagem de perfis aprovado.

Sua missão é produzir SEIS entregas de documentação que cobrem o
sistema de forma completa — do usuário final ao técnico, do manual
operacional à página de ajuda contextual.

PROTOCOLO: apresente o índice de cada entrega para aprovação antes
de escrever o conteúdo completo. Entregue uma por vez.

═══════════════════════════════════════════════════════════════════
CONTEXTO DO SISTEMA (leia com atenção antes de começar)
═══════════════════════════════════════════════════════════════════

O SIAFI é o sistema financeiro da Lidera Tecnologia e Gestão Ltda.
Versão atual: 2.0 · Maio 2026

STACK: NestJS 10 + Next.js 16 + Prisma + PostgreSQL (Supabase) +
BullMQ + Redis (Upstash) + Supabase Auth + Storage + Realtime

PERFIS ATIVOS (5 roles):
  admin | financeiro | consultor | caixa | cliente

MÓDULOS IMPLEMENTADOS (inventário completo):
  Auth/MFA, Clientes, Empréstimos (split de parcela), Parcelas,
  Pagamentos (com pagamento parcial), Caixa, Intenções de Empréstimo,
  Solicitações ao Financeiro, Reparcelamento, Comunicador Interno,
  PIX/Boleto (Mercado Pago), Cobrança Antecipada (configurável),
  Portal do Cliente, Notificações (WhatsApp + Email), BullMQ/Redis,
  Relatórios (carteira + faturamento + aging), Auditoria,
  Templates de Email (painel administrativo), Suporte/Tickets,
  Score de Risco Interno, Liberação de Capital

FLUXO PRINCIPAL (resumido):
  Consultor cadastra cliente → intenção de empréstimo →
  Financeiro aprova/rejeita (SLA 24h) →
  Contrato gerado com split (principal_payback + net_gain) →
  Cliente assina digitalmente (SLA 7 dias) →
  Caixa confirma entrega do capital →
  Parcelas com dia fixo de vencimento →
  Cobrança automática X dias antes →
  Pagamento → split no caixa →
  Se atrasado: mora diária → solicitar reparcelamento

CONCEITOS FINANCEIROS DO SISTEMA:
  principal_amount  = capital entregue ao cliente
  target_profit     = lucro total do contrato
  total_receivable  = principal + lucro
  principal_payback = parte da parcela que recupera capital
  net_gain          = parte da parcela que é lucro
  installment_amount = principal_payback + net_gain (invariante)

SEGURANÇA:
  Supabase Auth + JWT + MFA obrigatório (admin/financeiro/consultor)
  RLS em todas as tabelas, LGPD, AuditLog imutável

═══════════════════════════════════════════════════════════════════
ENTREGA 1 — MANUAL DO USUÁRIO POR PERFIL
(substituir o 05_MANUAL_USUARIO.md existente)
═══════════════════════════════════════════════════════════════════

Arquivo: 05_MANUAL_USUARIO.md (versão 3.0)

O manual atual está desatualizado — foi escrito antes dos perfis
Consultor, dos fluxos de intenção, reparcelamento, split de parcela
e do portal do cliente. Precisa ser completamente reescrito.

## Estrutura obrigatória do novo manual:

O manual deve ter CINCO seções independentes, uma por perfil.
Cada seção deve ser autocontida — o usuário de cada perfil lê
apenas a sua seção sem precisar das outras.

### SEÇÃO GERAL (vale para todos os perfis)
- Acesso ao sistema: URL, login com email/CPF, login com Google
- Primeiro acesso e troca de senha obrigatória
- Configuração do Google Authenticator (MFA)
  - Perfis com MFA imediato: admin, financeiro, consultor
  - Perfis com prazo de 5 logins: caixa, cliente
- Navegação geral: menu lateral, topbar, notificações
- Como sair do sistema
- Suporte técnico: contatos

### SEÇÃO 1 — MANUAL DO CONSULTOR
Cobrir TODAS as funcionalidades do perfil:
1. Dashboard da carteira (KPIs, ações pendentes, cobranças urgentes)
2. Cadastrar novo cliente (campos, documentos, validações)
3. Minha carteira (lista, busca, filtros)
4. Detalhe do cliente (contratos, status, ativar portal)
5. Intenção de empréstimo (criar, acompanhar SLA, status)
6. Solicitações ao financeiro (tipos, urgência, acompanhar resposta)
7. Cobranças (parcelas atrasadas, registrar contato, resultado)
8. PIX / Boleto para clientes da carteira
9. Relatórios da carteira
10. Comunicador interno (mensagens, envio de documentos)
11. Dúvidas frequentes do consultor

### SEÇÃO 2 — MANUAL DO FINANCEIRO
1. Dashboard financeiro (fila SLA, liberações, aging)
2. Fila de intenções (analisar, aprovar, rejeitar com motivo)
   - Critérios de aprovação
   - Motivos predefinidos de rejeição
   - Score de risco do cliente
3. Liberações pendentes (confirmar entrega, método, data)
4. Solicitações dos consultores (analisar, responder)
5. Simulador de reparcelamento (novos termos, multa, mora)
6. Reparcelamento — segunda instância de aprovação
7. Criar contrato direto (campos de split + cobrança antecipada)
8. Configurações por contrato (multa, mora, dia vencimento, antecedência)
9. Gerenciar clientes e portal do cliente
10. Inadimplentes e carteira global
11. Relatórios (carteira, faturamento, aging de inadimplência)
12. Caixa (lançamentos, conciliação)
13. Comunicador e notificações
14. Dúvidas frequentes do financeiro

### SEÇÃO 3 — MANUAL DO CAIXA
1. Dashboard do caixa (foco no dia)
2. Liberar capital (fluxo passo a passo, métodos, comprovante)
   ⚠️ Aviso: saída no caixa ocorre APENAS ao confirmar a entrega
3. Registrar pagamento (busca CPF → parcela → confirmar)
   - Entender encargos (multa + mora) na parcela atrasada
   - Pagamento parcial: o que acontece
   - Recibo pós-pagamento
4. Parcelas do dia (vencimentos hoje + atrasadas)
5. Consultar cliente (somente leitura)
6. Saldo e movimentações do caixa
7. Lançamentos manuais (entradas e saídas operacionais)
8. Dúvidas frequentes do caixa

### SEÇÃO 4 — MANUAL DO ADMINISTRADOR
(herda todas as funções do financeiro, mais:)
1. Gerenciar operadores (criar, editar, ativar/desativar)
   - Criar consultor: vinculação à carteira
   - Reset de senha
   - Status de MFA por usuário
2. Configurações do sistema
   - Encargos globais: multa, mora diária
   - SLAs: intenção (24h), aceite (7d), escalonamento (48h)
   - Limites: reparcelamentos, contratos por cliente
   - Cobrança: dias de antecedência padrão
3. Templates de email (editor, preview, enviar teste)
4. Auditoria (filtrar por usuário, ação, entidade, data)
5. Configurações de integração (WhatsApp, Mercado Pago, SMTP)
6. Dúvidas frequentes do administrador

### SEÇÃO 5 — MANUAL DO CLIENTE (PORTAL)
1. Acesso ao portal (URL, primeiro acesso, troca de senha)
2. MFA para clientes (configurar, usar, o que fazer se perder acesso)
3. Meus contratos (lista, barra de progresso, detalhe)
4. Ver parcelas (status: pendente, parcialmente pago, pago, atrasado)
5. Pagar com PIX (gerar QR Code, copia e cola, prazo, confirmação)
6. Baixar boleto (quando disponível, formatos)
7. Solicitar reparcelamento (como fazer, prazo de resposta)
8. Solicitar boleto atualizado (com encargos calculados)
9. Histórico de pagamentos
10. Abrir chamado de suporte (tipos, como acompanhar)
11. Meu perfil (alterar senha, MFA, preferências de notificação)
12. Dúvidas frequentes do cliente

## Padrão de escrita do manual:
- Linguagem direta e simples — sem jargão técnico para usuários finais
- Instruções em lista numerada (passo a passo)
- Capturas de tela substituídas por descrições textuais precisas
- Caixas de aviso: ⚠️ Atenção · ℹ️ Informação · ✅ Dica
- Dúvidas frequentes com perguntas reais (não genéricas)
- Sem expor terminologia interna: nunca escrever principal_payback,
  net_gain, target_profit — usar linguagem de negócio:
  "capital emprestado", "juros do contrato", "valor da parcela"

═══════════════════════════════════════════════════════════════════
ENTREGA 2 — DOCUMENTAÇÃO TÉCNICA ATUALIZADA
(atualizar os 4 arquivos de documentação base do projeto)
═══════════════════════════════════════════════════════════════════

Arquivos: 01_ARQUITETURA.md, 02_BACKEND.md, 03_FRONTEND.md, 04_DATABASE.md

Os arquivos base foram escritos no início do projeto e estão
desatualizados. Precisam refletir tudo que foi implementado.

### 01_ARQUITETURA.md — atualizar:
- Diagrama Mermaid: adicionar módulos novos (ConsultorModule,
  IntencaoModule, ReparcelamentoModule, EmailModule, CobrancaModule,
  ComunicadorModule, ScoreRiscoModule)
- LoanStatus: aguardando_aceite, aguardando_liberacao, ativo, quitado
- Novos fluxos de Auth: SLA de aceite, expiração de proposta
- Supabase Realtime: tabelas ativas (installments, payments, transactions,
  mensagens, solicitacoes_reparcelamento)
- BullMQ: filas notif-queue e payment-queue com job types completos
- Bucket Storage: client-documents, boletos-cobranca, mensagens-docs

### 02_BACKEND.md — atualizar:
- Estrutura de módulos: adicionar todos os novos (email, cobrança,
  consultor, intenção, reparcelamento, comunicador, score-risco)
- Endpoints novos: listar todos os endpoints adicionados nos prompts
- Novos models no banco: EmailTemplate, IntencaoEmprestimo,
  ConsultorSolicitacao, SolicitacaoReparcelamento, Mensagem, Conversa,
  ConversaParticipante, ScoreRisco, CobrancaContato
- Lógica de split de parcela (decimal.js)
- Cron jobs atualizados (adicionar verificarSlaAceite,
  enviarCobrancasAntecipadas, atualizarEncargos, reenviarCobrancaNaoLida)
- Segurança: filtros por consultorId, ocultação de split para caixa

### 03_FRONTEND.md — atualizar:
- Estrutura de diretórios: adicionar todas as novas rotas por perfil
- Route-Role Guard: ROUTE_ROLES completo com todas as 25+ rotas
- Sidebar: grupos por perfil (consultor/financeiro/caixa/admin)
- Dashboards por perfil (4 arquivos separados)
- Novos componentes: SimuladorReparcelamento, ScoreRiscoCard,
  EmailPreview, EmailVariableHelper, AceiteDigital, etc.
- Hooks novos: useRealtimePortal, useConversaRealtime,
  useMensagensNaoLidas, usePortalPix, useEmailTemplate

### 04_DATABASE.md — atualizar:
- Schema Prisma completo e atualizado (todos os models novos)
- Enum LoanStatus com novos valores
- Enum InstallmentStatus com parcialmente_pago
- Enum UserRole sem 'usuario', com 'consultor'
- Buckets Storage: client-documents, boletos-cobranca, mensagens-docs
- Publication supabase_realtime: tabelas ativas

## Padrão da documentação técnica:
- Markdown com headers hierárquicos
- Código TypeScript/Prisma em blocos formatados
- Tabelas para endpoints (método, rota, roles, descrição)
- Mermaid para diagramas
- Comentários em código explicando decisões de arquitetura
- Datas de atualização no rodapé

═══════════════════════════════════════════════════════════════════
ENTREGA 3 — PÁGINA "SOBRE" DO SISTEMA
(página no frontend: /sobre)
═══════════════════════════════════════════════════════════════════

Arquivo: frontend/src/app/(dashboard)/sobre/page.tsx

Página estática e institucional sobre o SIAFI, acessível para todos
os perfis autenticados. Design consistente com o sistema (Tailwind +
shadcn/ui + paleta Slate/dark).

### Seções da página:

#### Hero
- Nome do sistema: SIAFI 2.0
- Subtítulo: "Sistema de Agilidade Financeira"
- Empresa: Lidera Tecnologia e Gestão Ltda.
- Versão: 2.0 · Maio 2026
- Badge: "Sistema em operação" com indicador verde pulsante

#### O que é o SIAFI
Texto de 2-3 parágrafos sobre o propósito do sistema.
Linguagem institucional, sem jargão técnico.

#### Números do sistema (cards animados com contador)
- 5 perfis de acesso
- 25+ telas operacionais
- 20+ módulos ativos
- 13 tipos de email automatizados
- 3 canais de cobrança (WhatsApp, Email, Portal)
- Uptime 99,9% (SLA)

#### Funcionalidades principais (grid de cards com ícone)
Organizar em 3 colunas, 2 linhas:
1. Gestão de Carteira — controle completo de clientes e contratos
2. Split de Faturamento — separação automática entre capital e lucro
3. Cobrança Inteligente — envio automático antes do vencimento
4. Portal do Cliente — autoatendimento com PIX integrado
5. Comunicador Interno — mensagens com contexto de contratos
6. Conformidade e Segurança — MFA, RLS, AuditLog imutável

#### Stack tecnológica (para o admin — mostrar apenas se role = admin)
Linha de logos/badges: NestJS · Next.js · PostgreSQL · Supabase ·
BullMQ · Redis · Mercado Pago · Evolution API

#### Linha do tempo do projeto (timeline vertical)
- Jan 2026: Início do desenvolvimento
- Mar 2026: Módulos core (clientes, empréstimos, parcelas)
- Abr 2026: Integração Mercado Pago + Portal do Cliente
- Mai 2026: Split de parcela + Perfil Consultor + Sistema de Email
- Mai 2026: Remodelagem de telas por perfil ← atual

#### Créditos e suporte
- Desenvolvido por: Lidera Tecnologia e Gestão Ltda.
- Suporte: lideraabrange@gmail.com
- Versão do sistema: 2.0.0
- Última atualização: Maio 2026

═══════════════════════════════════════════════════════════════════
ENTREGA 4 — PÁGINA DE DOCUMENTAÇÃO INTERNA
(página no frontend: /documentacao)
═══════════════════════════════════════════════════════════════════

Arquivo: frontend/src/app/(dashboard)/documentacao/page.tsx
(visível apenas para admin)

Documentação técnica navegável dentro do sistema, útil para
onboarding de desenvolvedores e manutenção.

### Estrutura da página:

#### Layout: sidebar de navegação + área de conteúdo
Similar ao formato da documentação do Supabase/Stripe.

#### Seções (sidebar esquerda):

**Visão Geral**
- Arquitetura do sistema
- Stack tecnológica
- Ambientes (dev/produção)
- Variáveis de ambiente

**Banco de Dados**
- Models e relacionamentos (tabela visual)
- Enums ativos
- Convenções (snake_case, soft-delete, etc.)
- Conexão Supabase (pooler vs direct)

**Autenticação**
- Fluxo Supabase Auth + JWT
- Roles e permissões
- MFA por perfil
- OAuth Google (como funciona)

**Módulos Backend**
- Lista de módulos com descrição e endpoints
- Guards e decorators
- Interceptors (AuditInterceptor)
- Filas BullMQ (jobs por fila)

**Frontend**
- Estrutura de rotas
- Route-Role Guard
- Dashboards por perfil
- Componentes reutilizáveis

**Fluxos de Negócio**
- Fluxo de empréstimo (diagrama)
- Fluxo de intenção e aprovação
- Fluxo de reparcelamento
- Fluxo do portal do cliente

**Integrações**
- Mercado Pago (PIX, webhook)
- Evolution API (WhatsApp)
- Supabase Storage (buckets)
- Supabase Realtime (tabelas)
- SMTP (email)

**Deploy e Operações**
- Build e deploy (Windows Server + NSSM)
- Nginx (configuração)
- PM2 / NSSM
- Migrations (Prisma)
- Monitoramento (BullBoard)

### Implementação técnica:
- Conteúdo armazenado como constantes TypeScript (não banco)
- Syntax highlighting para código (usar `<pre><code>`)
- Busca simples no frontend (filter sobre títulos)
- Breadcrumb de navegação
- Âncoras para link direto a seções

═══════════════════════════════════════════════════════════════════
ENTREGA 5 — CENTRAL DE AJUDA
(página no frontend: /ajuda)
═══════════════════════════════════════════════════════════════════

Arquivo: frontend/src/app/(dashboard)/ajuda/page.tsx
(visível para todos os perfis autenticados, conteúdo filtrado por role)

Central de ajuda contextual: o usuário vê apenas as categorias
relevantes para o seu perfil.

### Estrutura da página:

#### Barra de busca
Campo de busca que filtra perguntas em tempo real (client-side).
Placeholder: "O que você precisa saber? Ex: como registrar pagamento"

#### Categorias por perfil (grid de cards clicáveis):

Para consultor:
- 📋 Intenções de Empréstimo (8 artigos)
- 👥 Gestão da Carteira (6 artigos)
- ⚠️ Cobranças e Inadimplência (5 artigos)
- 💬 Comunicador Interno (4 artigos)

Para financeiro (+ consultor):
- 📊 Análise e Aprovação (7 artigos)
- 💰 Contratos e Liberação (6 artigos)
- 🔄 Reparcelamentos (5 artigos)
- 📈 Relatórios Financeiros (4 artigos)

Para caixa:
- ⏳ Liberar Capital (4 artigos)
- 💳 Registrar Pagamentos (6 artigos)
- 💵 Controle de Caixa (4 artigos)

Para admin (+ todos):
- ⚙️ Configurações do Sistema (8 artigos)
- 📧 Templates de Email (5 artigos)
- 👤 Gestão de Usuários (4 artigos)

Para todos:
- 🔐 Segurança e MFA (5 artigos)
- 🌐 Portal e Clientes (6 artigos)
- ❓ Primeiros Passos (4 artigos)

#### Artigos mais acessados (seção fixa)
Top 5 artigos com base em categorias prioritárias por perfil.

#### Artigos por categoria (ao clicar na categoria)
Accordion com pergunta + resposta expandível.

### Base de artigos — exemplos por categoria:

**Intenções de Empréstimo:**
- Como criar uma intenção de empréstimo?
- O que acontece após enviar a intenção?
- Por que minha intenção foi rejeitada?
- Como informar o cliente sobre o resultado?
- O que é o SLA de análise e como funciona?
- A intenção expirou — o que fazer?
- Como acompanhar o status da intenção?
- Posso editar uma intenção após enviar?

**Liberar Capital (caixa):**
- Quando devo confirmar a liberação de capital?
- Quais métodos posso registrar?
- O que acontece se confirmar a data errada?
- Preciso de comprovante obrigatoriamente?

**Registrar Pagamentos:**
- Como registrar um pagamento recebido em dinheiro?
- O cliente pagou menos que o valor da parcela. O que fazer?
- A parcela está com multa e mora. Como calcular o total?
- Registrei um pagamento errado. Como estornar?
- O PIX foi pago mas não apareceu como confirmado. Por quê?

**Segurança e MFA:**
- Como configurar o Google Authenticator?
- Perdi meu celular — como recuperar o acesso?
- O que acontece se não configurar o MFA no prazo?
- Como saber se minha conta está protegida?
- O que é o login com Google e como ativar?

**Portal do Cliente:**
- Como gerar um QR Code PIX para o cliente?
- O cliente não recebeu o email de ativação. O que fazer?
- Como baixar o boleto de uma parcela?
- O cliente esqueceu a senha do portal. Como resetar?

### Implementação técnica:
- Dados dos artigos como array TypeScript (sem banco)
- Filtro por role do AuthContext
- Busca com `filter()` client-side (debounce 300ms)
- Accordion com animação suave (shadcn/ui)
- Cada artigo tem: categoria, role(s), pergunta, resposta (HTML simples)
- Botão "Isso não respondeu minha dúvida → Abrir chamado" ao final

═══════════════════════════════════════════════════════════════════
ENTREGA 6 — MANUAL DO SISTEMA (DOCUMENTO PDF GERADO PELO SISTEMA)
(gerado em /admin/manual-sistema)
═══════════════════════════════════════════════════════════════════

Endpoint: GET /api/admin/manual-sistema → retorna PDF
Frontend: botão "Baixar Manual do Sistema" em /documentacao ou /sobre
(visível apenas para admin)

Manual técnico-operacional completo em formato PDF, gerado
dinamicamente pelo NestJS com os dados atuais do sistema.

### Capítulos do manual:

**Capítulo 1 — Visão Geral do Sistema**
- Propósito e escopo
- Arquitetura e stack
- Módulos ativos
- Usuários e perfis

**Capítulo 2 — Instalação e Configuração**
- Requisitos de ambiente
- Variáveis de ambiente
- Banco de dados (migrations)
- Supabase (configurações)
- Deploy Windows Server + NSSM + Nginx
- Configurar SSL

**Capítulo 3 — Operação por Perfil**
- Fluxo do Consultor (passo a passo com imagens/mockups)
- Fluxo do Financeiro
- Fluxo do Caixa
- Funções exclusivas do Admin

**Capítulo 4 — Fluxos de Negócio**
- Ciclo completo de empréstimo
- Intenção → Aprovação → Contrato → Liberação → Parcelas
- Inadimplência → Reparcelamento
- Portal do Cliente

**Capítulo 5 — Integrações**
- Mercado Pago: configurar, testar, webhook
- Evolution API: configurar instância WhatsApp
- SMTP: configurar Gmail, Outlook, etc.

**Capítulo 6 — Manutenção e Monitoramento**
- BullBoard: monitorar filas
- Logs e Auditoria
- Backup do banco
- Procedimentos de recuperação

**Apêndice A — Glossário**
- Todos os termos financeiros do sistema

**Apêndice B — Tabela de Permissões**
- Matriz completa role × funcionalidade

**Apêndice C — Endpoints da API**
- Tabela completa de endpoints com método, rota, roles e descrição

### Implementação técnica:
- Usar Puppeteer (já disponível no projeto para PDF de contratos)
- Template HTML com estilos inline (compatível com PDF)
- Cabeçalho com logo da empresa (SiteSetting: empresa.logoUrl)
- Rodapé com número de página e data de geração
- Sumário clicável (âncoras)
- Endpoint protegido: @Roles('admin') + JwtAuthGuard
- AuditLog: registrar toda geração do manual

═══════════════════════════════════════════════════════════════════
ORDEM DE EXECUÇÃO E PROTOCOLO
═══════════════════════════════════════════════════════════════════

Execute nesta ordem. Para cada entrega:

PASSO 1 — Apresente o índice completo da entrega
  - Títulos de todas as seções
  - Estimativa de profundidade de cada seção
  - Pontos de decisão (onde precisa de confirmação sua)
  → AGUARDAR CONFIRMAÇÃO ANTES DE ESCREVER

PASSO 2 — Escreva o conteúdo completo
  - Sem pular seções
  - Sem "..." onde deveria haver conteúdo
  - Sem "conforme descrito anteriormente"
  - Cada seção completa e autocontida

PASSO 3 — Gere o arquivo final
  - Em formato .md para os manuais e documentação
  - Em formato .tsx para as páginas frontend
  - Em formato .ts para os dados dos artigos da central de ajuda

PASSO 4 — Informe o que foi entregue e aguarde confirmação
  para avançar para a próxima entrega

═══════════════════════════════════════════════════════════════════
REGRAS DE ESCRITA INVIOLÁVEIS
═══════════════════════════════════════════════════════════════════

LINGUAGEM:
- Manual do usuário: linguagem simples, direta, sem jargão técnico
- Documentação técnica: precisa, com exemplos de código reais
- Página Sobre: institucional, confiante, sem tecnicismo excessivo
- Central de ajuda: conversacional, empática, orientada a tarefas

CONSISTÊNCIA TERMINOLÓGICA:
Manual/Ajuda (para usuários finais):
  ✅ "Capital emprestado" (não principal_amount)
  ✅ "Juros do contrato" ou "acréscimo" (não target_profit)
  ✅ "Valor da parcela" (não installment_amount)
  ✅ "Encargos por atraso" (não mora/multa técnica)
  ✅ "Perfil de acesso" (não role)
  ✅ "Autenticação em dois fatores" (não MFA)

Documentação técnica (para desenvolvedores):
  ✅ Usar nomenclatura exata: principal_amount, target_profit, etc.
  ✅ Mostrar código real, não pseudocódigo
  ✅ Referenciar arquivos com caminhos reais

NUNCA FAZER:
- Inventar funcionalidades que não foram implementadas
- Contradizer os fluxos documentados nos prompts
- Usar "em breve" ou "futuro" para features já implementadas
- Deixar seções vazias ou com placeholder
- Repetir o mesmo conteúdo em múltiplas seções sem motivo
```
