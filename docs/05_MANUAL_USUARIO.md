# SIAFI 2.0 — Manual do Usuário Operador

> **Sistema Integrado de Apoio Financeiro — Lidera**
> Versão 2.0 · Maio 2026

---

## Sumário

1. [Acesso ao Sistema](#1-acesso-ao-sistema)
2. [Tela Principal (Dashboard)](#2-tela-principal-dashboard)
3. [Clientes](#3-clientes)
4. [Empréstimos](#4-empréstimos)
5. [Parcelas](#5-parcelas)
6. [Pagamentos](#6-pagamentos)
7. [Caixa](#7-caixa)
8. [Inadimplentes](#8-inadimplentes)
9. [Renegociações](#9-renegociações)
10. [PIX](#10-pix)
11. [Relatórios](#11-relatórios)
12. [Conciliação Bancária](#12-conciliação-bancária)
13. [Notificações](#13-notificações)
14. [Suporte](#14-suporte)
15. [Usuários do Sistema](#15-usuários-do-sistema)
16. [Configurações](#16-configurações)
17. [Auditoria](#17-auditoria)
18. [Perfis de Acesso](#18-perfis-de-acesso)
19. [Dúvidas Frequentes](#19-dúvidas-frequentes)

---

## 1. Acesso ao Sistema

**URL de Acesso:** https://financeiro.lidera.app.br

### Como fazer login

1. Acesse a URL do sistema no navegador
2. Digite seu **usuário** (ex: `joao.silva`)
3. Digite sua **senha**
4. Clique em **Entrar**

> Caso esqueça a senha, entre em contato com o Administrador do sistema.

### Autenticação em Dois Fatores (MFA)

Se o seu perfil é **Administrador** ou **Financeiro** e você configurou a autenticação em dois fatores:
1. Após inserir usuário e senha, o sistema solicitará um **código de verificação**
2. Abra o aplicativo autenticador no seu celular (Google Authenticator, Authy, etc.)
3. Digite o código de 6 dígitos exibido no app
4. Clique em **Verificar**

> O código muda a cada 30 segundos. Digite antes de expirar.

### Configurar autenticação em dois fatores

Se você deseja ativar o MFA no seu perfil:
1. Entre no sistema normalmente
2. Acesse **Configurações → Segurança → Ativar Autenticação em Dois Fatores**
3. Escaneie o QR Code com seu aplicativo autenticador
4. Confirme com o primeiro código gerado

### Login com Google

Usuários que possuem conta Google vinculada podem clicar em **Entrar com Google** na tela de login.

### Sair do sistema

Clique no seu nome no canto superior direito → **Sair**.

---

## 2. Tela Principal (Dashboard)

A tela inicial apresenta um resumo de toda a operação financeira, **atualizado automaticamente em tempo real**.

### Cards de Resumo (clicáveis)

| Card | O que mostra | Clique para |
|------|-------------|------------|
| **Clientes Ativos** | Total de clientes ativos | Abrir lista de clientes |
| **Empréstimos Ativos** | Total de contratos ativos | Abrir lista de empréstimos |
| **Clientes Atrasados** | Clientes com parcela vencida | Abrir carteira inadimplente |
| **Clientes Quitados** | Clientes com empréstimo pago | Informativo |

> Os cards **Empréstimos Ativos** são visíveis apenas para perfis Administrador e Financeiro.

### Atualização em Tempo Real

O dashboard atualiza os dados automaticamente quando pagamentos são registrados ou parcelas mudam de status. Um indicador verde pulsante no canto superior confirma que a conexão em tempo real está ativa.

### Lista de Clientes Atrasados

Exibe o nome de cada cliente em atraso e a quantidade de parcelas pendentes. Clique no nome para ver o perfil completo do cliente.

### Lista de Clientes Quitados

Exibe clientes que já quitaram seus empréstimos. Clique no nome para ver o histórico.

---

## 3. Clientes

Menu: **Operacional → Clientes**

### Ver lista de clientes

- Use a barra de **busca** para localizar por nome, CPF ou WhatsApp
- Filtre por **Status**: Todos · Ativos · Inativos
- Navegue pelas páginas com os botões **Anterior / Próximo**

### Cadastrar novo cliente

1. Clique em **Novo Cliente**
2. Preencha os **Dados Pessoais**: Nome, CPF/CNPJ, RG, Data de Nascimento
3. Preencha os **Dados de Contato**: WhatsApp, Telefone, E-mail
4. Preencha o **Endereço**: Rua, Bairro, Cidade, Estado, CEP
5. Faça upload de documentos (opcional): Foto, RG, Comprovante de Endereço
6. Clique em **Salvar Cliente**

> **CPF ou CNPJ:** O campo aceita tanto CPF (pessoa física, 11 dígitos) quanto CNPJ (empresa, 14 dígitos). A formatação é aplicada automaticamente conforme você digita. O CPF é único no sistema — não é possível cadastrar dois clientes com o mesmo CPF/CNPJ.

> **Documentos:** Os arquivos são armazenados de forma segura na nuvem. Formatos aceitos: JPG, PNG, WEBP e PDF. Tamanho máximo: 10 MB por arquivo.

### Ver detalhes do cliente

Clique no botão **Ver** ou no nome do cliente para abrir o perfil completo, que exibe:
- Dados pessoais e de contato
- Endereço
- **Documentos**: visualização dos arquivos enviados (foto, RG, comprovante)
- **Contratos (Empréstimos)**: listados sequencialmente (Contrato 1, Contrato 2...) com status
- Botão para criar novo empréstimo para esse cliente

### Editar cliente

No perfil do cliente, clique em **Editar** e altere os campos necessários.
Campos opcionais podem ser deixados em branco. Documentos existentes são mantidos se nenhum novo arquivo for selecionado.

### Inativar cliente

Na lista de clientes, clique no ícone de **lixeira** na linha do cliente. O sistema exibe uma confirmação antes de desativar.

> Clientes inativos não são excluídos — apenas ficam invisíveis nas listagens padrão.

---

## 4. Empréstimos

Menu: **Operacional → Empréstimos**

### Ver lista de empréstimos

- Busque por **nome do cliente** ou CPF
- Filtre por **Status**: Todos · Ativos · Quitados · Inadimplentes · Cancelados
- O rodapé exibe o **total de contratos** e a **soma dos valores** conforme o filtro

### Criar novo empréstimo

1. Clique em **Novo Empréstimo**
2. Selecione o **Cliente**
3. Informe o **Valor do Empréstimo** (valor entregue ao cliente)
4. Informe o **Valor Investido** (opcional — custo de capital)
5. Informe o **Número de Parcelas**
6. Informe o **Valor da Parcela** (cada prestação que o cliente pagará)
7. Selecione a **Forma de Pagamento** (Dinheiro, PIX, Cartão, etc.)
8. Defina a **Data de Início** (data da primeira parcela)
9. Adicione **Observações** se necessário

**Simulação ao vivo** (atualiza conforme você digita):
- Capital · Parcelas × Valor · Total a Pagar · Total de Acréscimo

10. Clique em **Criar Empréstimo**

> O sistema gera automaticamente todas as parcelas mensais a partir da data de início.

### Ver detalhes do empréstimo

Clique em **Ver** (ícone de olho) para abrir o detalhamento com:
- Resumo: Valor Emprestado · Total a Pagar · Total Pago · Pendente
- Informações do contrato (taxa, parcelas, data)
- Tabela de todas as parcelas com status e botões de ação
- Botões: **Renegociar** · **Cancelar Empréstimo**

### Registrar pagamento rápido (inline)

Na tela de detalhe do empréstimo, clique em **Pagar** na linha da parcela desejada:
1. O sistema pré-preenche o saldo devedor
2. Confirme ou ajuste o **Valor Pago**
3. Selecione o **Método de Pagamento**
4. Clique em **Confirmar Pagamento**

> É possível pagar um valor **maior** que o saldo da parcela (para incluir multa ou mora).

### Cancelar empréstimo

No detalhamento, clique em **Cancelar** (botão vermelho). O sistema cancela o contrato e todas as parcelas pendentes.

---

## 5. Parcelas

Menu: **Operacional → Parcelas**

Exibe todas as parcelas em atraso do sistema, ordenadas por data de vencimento mais antiga.

| Coluna | Descrição |
|--------|-----------|
| Cliente | Nome do cliente devedor |
| Empréstimo | Número do contrato |
| Parcela | Número da parcela |
| Vencimento | Data de vencimento original |
| Dias em Atraso | Quantos dias desde o vencimento |
| Saldo | Valor ainda não pago |

Botões por parcela:
- **Pagar**: abre o formulário de pagamento para essa parcela
- **PIX**: gera QR Code para essa parcela

---

## 6. Pagamentos

Menu: **Operacional → Pagamentos**

### Ver histórico de pagamentos

Lista todos os pagamentos recebidos, com filtro por busca de cliente.

### Registrar novo pagamento

1. Clique em **Registrar Pagamento**
2. Selecione o **Cliente**
3. Selecione o **Empréstimo** do cliente
4. Selecione a **Parcela** específica
5. Informe o **Valor Pago**
6. Informe a **Data do Pagamento**
7. Selecione o **Método** (Dinheiro, PIX, etc.)
8. Adicione **Observação** se necessário
9. Clique em **Confirmar Pagamento**

> O valor é pré-preenchido automaticamente com o saldo devedor da parcela.

### Estornar pagamento

Na lista de pagamentos, clique em **Estornar** (apenas Administrador e Financeiro). O sistema:
- Remove o pagamento
- Recalcula o saldo da parcela
- Reverte o status da parcela para pendente ou atrasado
- Reverte o empréstimo de "Quitado" para "Ativo" se necessário

---

## 7. Caixa

Menu: **Financeiro → Caixa**

### Saldo atual

Exibe o resumo financeiro do mês:
- **Entradas**: pagamentos recebidos + entradas manuais
- **Saídas**: despesas registradas
- **Saldo**: diferença

### Lançar transação manual

Para registrar despesas ou entradas que não são pagamentos de parcelas:
1. Preencha a **Descrição**
2. Selecione o **Tipo**: Entrada ou Saída
3. Informe o **Valor**
4. Informe a **Data**
5. Selecione a **Categoria**
6. Clique em **Lançar**

---

## 8. Inadimplentes

Menu: **Operacional → Inadimplentes**

Lista todos os clientes com parcelas em atraso, mostrando:
- Nome do cliente
- Saldo devedor total
- Botões: **Renegociar** · **Ver Empréstimo**

> Use esta tela para priorizar a cobrança dos clientes inadimplentes.

---

## 9. Renegociações

Menu: **Financeiro → Renegociações**

### O que é uma renegociação?

Renegociar significa cancelar as parcelas pendentes e atrasadas de um empréstimo e substituí-las por novas condições.

### Criar nova renegociação

1. Acesse **Renegociações → Nova Renegociação**
2. Selecione o **Empréstimo** a ser renegociado
3. Defina o **Novo Número de Parcelas**
4. Defina a **Nova Taxa de Juros** (%)
5. Defina a **Data de Início** das novas parcelas
6. Adicione **Observações** sobre o motivo
7. Clique em **Confirmar Renegociação**

> **Atenção:** Esta operação é irreversível. As parcelas antigas são canceladas e substituídas pelas novas.

---

## 10. PIX

Menu: **Financeiro → PIX**

### Gerar QR Code para pagamento

1. Selecione o **Cliente**
2. Selecione o **Empréstimo**
3. Selecione a **Parcela**
4. Clique em **Gerar QR Code PIX**

O sistema exibe:
- Imagem do QR Code para escanear
- **Código Copia e Cola** (botão de copiar)
- Valor e data de geração

> O QR Code expira conforme configuração do Mercado Pago.

---

## 11. Relatórios

Menu: **Relatórios → Relatórios**

### Aba Carteira

Visão geral da carteira de crédito ativa:

| Indicador | O que significa |
|-----------|----------------|
| **Valor Investido** | Soma do capital desembolsado nos empréstimos ativos |
| **Valor Total Parcelado** | Soma de todas as parcelas dos empréstimos ativos |
| **Valor Recebido** | Total já recebido em pagamentos |
| **A Receber** | Parcelas pendentes e em atraso |
| Empréstimos Ativos | Quantidade de contratos ativos |
| Empréstimos em Atraso | Contratos com pelo menos 1 parcela vencida |

### Aba Clientes

Resumo do portfólio de clientes:
- Total de clientes
- Clientes com empréstimo ativo
- Inadimplentes
- Novos cadastros no mês

### Aba Movimentação

Entradas e saídas em um período selecionado:
1. Defina a **Data Inicial** e **Data Final**
2. Clique em **Gerar**
3. O sistema exibe Entradas · Saídas · Saldo do período

### Aba Contratos

Lista de todos os contratos com filtro por status.
- Filtre por: Todos · Ativos · Quitados · Inadimplentes · Cancelados
- **Rodapé**: exibe quantidade de contratos e soma total dos valores

---

## 12. Conciliação Bancária

Menu: **Financeiro → Conciliação**

Permite visualizar toda a movimentação financeira de um mês específico:
1. Selecione o **Mês** e o **Ano**
2. O sistema lista todas as transações e pagamentos do período
3. Compare com o extrato bancário para identificar divergências

---

## 13. Notificações

Menu: **Comunicação → Notificações**

Exibe o histórico de todas as notificações enviadas pelo sistema (WhatsApp e E-mail):
- Data e hora de envio
- Tipo (lembrete, cobrança, confirmação)
- Cliente destinatário
- Status (enviado, falhou)

---

## 14. Suporte

Menu: **Comunicação → Suporte**

Lista os tickets de atendimento abertos pelos clientes no Portal do Cliente.

| Status | Significado |
|--------|------------|
| **Aberto** | Aguardando resposta da equipe |
| **Respondido** | Equipe já respondeu |
| **Fechado** | Ticket encerrado |

---

## 15. Usuários do Sistema

Menu: **Administração → Usuários** *(apenas Administradores)*

### Ver lista de usuários

Exibe todos os operadores cadastrados com nome, usuário, perfil e status.

### Criar novo usuário

1. Clique em **Novo Usuário**
2. Informe o **Nome Completo**
3. Informe o **Username** (login — apenas letras minúsculas, números, ponto e underline)
4. Informe a **Senha** (mínimo 8 caracteres)
5. Selecione o **Perfil de Acesso**:
   - **Usuário**: apenas visualização do dashboard
   - **Caixa**: pagamentos e caixa
   - **Financeiro**: operacional completo
   - **Administrador**: acesso total
   - **Cliente**: portal do cliente
6. Clique em **Criar Usuário**

> O usuário é criado automaticamente no sistema de autenticação. Não é necessário nenhuma configuração adicional.

### Editar usuário

Na lista, clique no ícone de edição. É possível alterar:
- Nome, Username, Perfil, Status (Ativo/Inativo)
- **Senha**: deixe em branco para manter a atual; preencha para trocar

---

## 16. Configurações

Menu: **Administração → Configurações** *(apenas Administradores)*

Permite ajustar parâmetros do sistema:

| Seção | Parâmetros |
|-------|-----------|
| **Sistema** | Nome da empresa, logo |
| **WhatsApp** | URL, chave e instância da Evolution API |
| **Mercado Pago** | Tokens de acesso e webhook |
| **E-mail** | Servidor SMTP e credenciais |
| **Empréstimos** | Valores padrão de taxa e parcelas |

---

## 17. Auditoria

Menu: **Administração → Auditoria** *(apenas Administradores)*

Registra automaticamente todas as ações realizadas no sistema:
- Quem realizou a ação (usuário)
- Quando foi realizada (data/hora)
- O que foi feito (ação e entidade)
- Endereço IP de origem

Use para rastrear alterações e garantir conformidade.

---

## 18. Perfis de Acesso

| Perfil | Dashboard | Clientes | Empréstimos | Pagamentos | Caixa | Relatórios | Usuários | Config | Auditoria |
|--------|-----------|----------|------------|------------|-------|-----------|---------|--------|-----------|
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Financeiro** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Caixa** | ✅ | Ler | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Usuário** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Estornar pagamento:** disponível apenas para Administrador e Financeiro.

---

## 19. Dúvidas Frequentes

**P: O empréstimo foi marcado como "Quitado" mas há um pagamento errado. O que fazer?**
R: Acesse o pagamento incorreto em **Pagamentos** e clique em **Estornar**. O sistema reverte automaticamente o status.

**P: Preciso aceitar um valor maior que o da parcela (com multa/mora)?**
R: Sim, o sistema aceita qualquer valor positivo. Na tela de pagamento, simplesmente insira o valor total incluindo multa e juros.

**P: Como identificar os empréstimos de um cliente específico?**
R: Acesse o perfil do cliente em **Clientes → [nome do cliente]**. A seção "Empréstimos" lista todos os contratos do cliente numerados sequencialmente (Contrato 1, 2, etc.).

**P: A parcela não aparece como "Paga" mesmo após o pagamento.**
R: Verifique se o valor total pago já atingiu o valor da parcela. Pode haver pagamentos parciais anteriores. Verifique em **Empréstimos → [empréstimo] → Parcelas**.

**P: Como gerar um QR Code PIX para cobrança?**
R: Acesse **PIX** no menu Financeiro, selecione o cliente → empréstimo → parcela e clique em **Gerar QR Code PIX**. Compartilhe o código com o cliente.

**P: Esqueci a senha de um operador. Como redefinir?**
R: Acesse **Usuários → [operador] → Editar**, preencha o campo **Nova Senha** e salve.

**P: Como registrar uma despesa no caixa?**
R: Acesse **Caixa**, preencha o formulário de lançamento com Tipo = Saída e o valor da despesa.

**P: O sistema pede um código mesmo depois de digitar usuário e senha.**
R: Seu perfil tem autenticação em dois fatores (MFA) ativada. Abra o aplicativo autenticador no celular e insira o código de 6 dígitos exibido.

**P: Posso cadastrar um cliente que é empresa (CNPJ)?**
R: Sim. O campo CPF/CNPJ aceita ambos. Digite os 14 dígitos do CNPJ — a formatação é aplicada automaticamente.

---

> **Suporte Técnico:** lideraabrange@gmail.com
>
> *Manual SIAFI 2.0 — Versão Maio 2026*
