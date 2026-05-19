# SIAFI 2.0 — Sistema Integrado de Apoio Financeiro

> Plataforma moderna de gestão de empréstimos e financeiro da **Lidera**.

- **URL Produção:** https://financeiro.lidera.app.br
- **Backend API:** http://localhost:4010/api
- **Frontend:** http://localhost:4011

---

## Stack

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Backend | NestJS + TypeScript + Prisma | 10 / 5 / 5 |
| Frontend | Next.js (App Router) + Tailwind CSS + shadcn/ui | 16 / 4 |
| Banco | MySQL 8 — banco `siafi_v2` | 8.x |
| Auth | JWT (15min) + Refresh Token (7d, httpOnly cookie) | — |
| Deploy | NSSM + Nginx 1.28 + Windows Server 2022 | — |

---

## Iniciar / Parar Serviços

```powershell
# Status
sc.exe query SIAFI-API; sc.exe query SIAFI-WEB

# Produção
sc.exe start SIAFI-API; sc.exe start SIAFI-WEB
sc.exe stop  SIAFI-API; sc.exe stop  SIAFI-WEB

# Desenvolvimento (parar produção primeiro)
sc.exe stop  SIAFI-API; sc.exe stop  SIAFI-WEB
sc.exe start SIAFI-API-DEV; sc.exe start SIAFI-WEB-DEV

# Logs em tempo real
Get-Content D:\LIDERA\SIAFI\logs\api-out.log -Tail 50 -Wait
Get-Content D:\LIDERA\SIAFI\logs\web-out.log -Tail 50 -Wait
```

---

## Deploy após Alterações de Código

```powershell
# Só backend mudou
sc.exe stop SIAFI-API
cd D:\LIDERA\SIAFI\backend; npm run build
sc.exe start SIAFI-API

# Só frontend mudou
sc.exe stop SIAFI-WEB
cd D:\LIDERA\SIAFI\frontend; npm run build
sc.exe start SIAFI-WEB

# Ambos mudaram (rodar em sequência)
sc.exe stop SIAFI-API; sc.exe stop SIAFI-WEB
cd D:\LIDERA\SIAFI\backend; npm run build
cd D:\LIDERA\SIAFI\frontend; npm run build
sc.exe start SIAFI-API; Start-Sleep 3; sc.exe start SIAFI-WEB
```

---

## Módulos Implementados (25 rotas)

| Módulo | Rota | Descrição |
|--------|------|-----------|
| Dashboard | /dashboard | KPIs clicáveis · lista Clientes Atrasados e Quitados |
| Clientes | /clientes | Lista com busca e paginação |
| Novo Cliente | /clientes/novo | Formulário com dados pessoais + endereço |
| Detalhe Cliente | /clientes/[id] | Perfil + contratos sequenciais |
| Editar Cliente | /clientes/[id]/editar | Edição com pré-preenchimento |
| Empréstimos | /emprestimos | Lista · filtro por status · soma por filtro |
| Novo Empréstimo | /emprestimos/novo | Valor da parcela direto + simulação |
| Detalhe Empréstimo | /emprestimos/[id] | Parcelas + pagamento inline |
| Parcelas | /parcelas | Parcelas em atraso com dias |
| Pagamentos | /pagamentos | Histórico + estorno |
| Novo Pagamento | /pagamentos/novo | Fluxo cliente → empréstimo → parcela |
| Inadimplentes | /inadimplentes | Carteira de inadimplência |
| Caixa | /caixa | Movimentação financeira + lançamentos |
| Renegociações | /renegociacoes | Lista de renegociações |
| Nova Renegociação | /renegociacoes/nova | Formulário de renegociação |
| PIX | /pix | Gerador QR Code (Mercado Pago) |
| Conciliação | /conciliacao | Conciliação bancária mensal |
| Relatórios | /relatorios | Carteira · Clientes · Movimentação · Contratos |
| Notificações | /notificacoes | Log de WhatsApp/Email |
| Suporte | /suporte | Tickets de atendimento |
| Usuários | /usuarios | CRUD de operadores do sistema |
| Novo Usuário | /usuarios/novo | Criar operador com role |
| Editar Usuário | /usuarios/[id]/editar | Editar dados + trocar senha |
| Configurações | /configuracoes | Parâmetros do sistema |
| Auditoria | /auditoria | Log paginado de ações |

---

## Estrutura de Permissões

| Role | Acesso |
|------|--------|
| `admin` | Acesso total ao sistema |
| `financeiro` | Operacional completo (sem gestão de usuários) |
| `caixa` | Clientes (leitura) + Pagamentos + Caixa |
| `usuario` | Apenas Dashboard |
| `cliente` | Apenas Portal do Cliente (/api/portal) |

---

## Variáveis de Ambiente

Arquivo: `D:\LIDERA\SIAFI\backend\.env`

```env
# Banco de dados
DATABASE_URL="mysql://db_financ3ir0:SENHA@localhost:3306/siafi_v2"

# JWT
JWT_SECRET="trocar-em-producao"
JWT_REFRESH_SECRET="trocar-em-producao"

# App
NODE_ENV=production
PORT=4010
FRONTEND_URL="http://localhost:4011,https://financeiro.lidera.app.br"

# Mercado Pago
MP_ACCESS_TOKEN="APP_USR-..."
MP_WEBHOOK_SECRET="..."

# WhatsApp (Evolution API)
WHATSAPP_API_URL="https://evolution.seudominio.com"
WHATSAPP_API_KEY="sua-key"
WHATSAPP_INSTANCE="nome-instancia"

# E-mail (SMTP)
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USER="email@gmail.com"
MAIL_PASS="app-password"
MAIL_FROM_NAME="SIAFI"
```

---

## Nginx

Configuração: `C:\nginx-1.28.0\conf\nginx.conf`

```powershell
# Testar configuração
C:\nginx-1.28.0\nginx.exe -t

# Recarregar sem derrubar
C:\nginx-1.28.0\nginx.exe -s reload
```

---

## Migração do Banco Legado

```powershell
cd D:\LIDERA\SIAFI\backend
npm run migrate
```

---

## Documentação Técnica Completa

| Arquivo | Conteúdo |
|---------|---------|
| `docs/01_ARQUITETURA.md` | Decisões de arquitetura e fluxo de requisição |
| `docs/02_BACKEND.md` | Guia completo do backend NestJS |
| `docs/03_FRONTEND.md` | Guia completo do frontend Next.js |
| `docs/04_DATABASE.md` | Schema do banco e migrações |
| `docs/05_MANUAL_USUARIO.md` | Manual do operador do sistema |
| `docs/06_APRESENTACAO.md` | Apresentação executiva do SIAFI |

---

*Última atualização: 2026-05-19*
