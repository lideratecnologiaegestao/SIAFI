# SIAFI 2.0
## Sistema Integrado de Apoio Financeiro

> **Lidera** · Gestão de Crédito e Empréstimos · 2026

---

## O Problema

A Lidera operava com:
- Planilhas Excel fragmentadas por operador
- Sem visibilidade em tempo real de inadimplência
- Cálculos de juros e mora feitos manualmente (erros frequentes)
- Sem rastreabilidade de ações (quem fez o quê, quando)
- Clientes sem canal de consulta próprio
- Notificações manuais por WhatsApp

---

## A Solução

**SIAFI 2.0** — plataforma web completa para gestão de crédito pessoal.

| Métrica | Valor |
|---------|-------|
| Módulos funcionais | 24 |
| Páginas no sistema | 35+ |
| Perfis de acesso | 5 (admin, financeiro, caixa, consultor, cliente) |
| Jobs agendados | 10 crons diários |
| Filas assíncronas | 2 (notificações + pagamentos) |
| Modelos de dados | 24 tabelas |
| Cobertura | Contratos · Parcelas · Pagamentos · Caixa · Relatórios · Portal |

---

## Diferenciais Competitivos

### 🔐 Segurança em Camadas
- Autenticação Supabase GoTrue (padrão bancário)
- MFA obrigatório configurável (TOTP)
- JWT de curta duração (15min) com refresh automático
- Row Level Security — clientes só veem dados próprios
- Audit log completo de todas as ações
- bcrypt rounds=12 para senhas

### 💳 Gestão de Contratos Completa
- Fluxo digital: intenção → aceite → liberação → parcelas → quitação
- Aceite digital com hash SHA-256
- SLA de aceite configurável (cliente tem N dias para assinar)
- Liberação manual de capital com registro no caixa
- Dia fixo de vencimento (1–28) independente do mês

### 📊 Score de Risco Interno
- Pontuação 0–100 calculada automaticamente
- Componentes: pontualidade (50%), reparcelamentos (30%), quitações (20%)
- Atualizado após cada pagamento, estorno ou marcação de atraso

### 📱 Cobrança Multicanal Automatizada
- Cobrança antecipada N dias antes do vencimento
- Canais configuráveis por contrato: WhatsApp, Email, Portal
- PDF boleto gerado automaticamente e enviado por email
- Reenvio automático para cobranças não visualizadas
- Mora diária + multa calculadas com precisão financeira (Decimal.js)

### 🔄 Reparcelamento Estruturado
- Fluxo: solicitação → proposta → 2ª aprovação → execução atômica
- Simulador inline antes de confirmar
- Aceite digital do cliente
- Histórico de reparcelamentos vinculado ao score

### 👥 Portal do Cliente
- Acesso próprio com email e senha
- Visualização de contratos e parcelas
- Pagamento via PIX com QR Code
- Abertura de tickets de suporte
- Aceite digital de contratos
- MFA disponível

### 🤝 Módulo Consultor
- Carteira própria com visão de clientes
- Criação de intenções de empréstimo
- Acompanhamento de cobranças
- Chat interno com financeiro
- Solicitações de reparcelamento

---

## Arquitetura Técnica

```
                    HTTPS (Let's Encrypt)
                         │
              ┌──────────▼──────────┐
              │     Nginx 1.28.0    │
              │   reverse proxy     │
              └──────┬──────────┬───┘
                     │          │
          ┌──────────▼──┐   ┌───▼──────────────┐
          │ NestJS :4010│   │ Next.js 16 :4011 │
          │ 24 módulos  │   │ 35+ páginas       │
          └──────┬───┬──┘   └──────────────────┘
                 │   │
         ┌───────▼┐ ┌▼────────────────────┐
         │ Redis  │ │   Supabase (SA)     │
         │ BullMQ │ │ PostgreSQL + Auth   │
         │Upstash │ │ Storage + Realtime  │
         └────────┘ └─────────────────────┘
```

**Stack completo:**

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 10 · TypeScript 5 · Prisma 5 |
| Frontend | Next.js 16 · Tailwind CSS 4 · shadcn/ui |
| Banco | PostgreSQL 15 via Supabase (sa-east-1) |
| Auth | Supabase GoTrue + JWT local |
| Filas | BullMQ + Redis Upstash |
| Email | Nodemailer + Hostinger SMTP (porta 465 SSL) |
| PIX | Mercado Pago API |
| WhatsApp | Evolution API |
| Realtime | Supabase Realtime (chat interno) |
| Deploy | NSSM + Nginx (Windows Server 2022) |

---

## Automação Diária

| Horário | Ação Automática |
|---------|----------------|
| 02h00 | Conciliação de PIX pendentes no Mercado Pago |
| 07h00 | Alerta de SLA de aceite (D-2 cliente, D-1 consultor); cancela vencidos |
| 08h00 | Marca parcelas vencidas como atrasadas |
| 08h05 | Aplica multa (1x) + mora diária sobre saldo devedor |
| 09h00 | Envia lembretes de vencimento (email + WhatsApp) |
| 09h30 | Gera PDF boleto e envia cobrança antecipada |
| 10h00 | Notifica inadimplentes |
| 11h00 | Lembrete de reparcelamentos pendentes |
| 14h00 | Reenvio de cobranças não visualizadas no portal |
| */2h | Verificação de SLA de intenções de empréstimo |

---

## Perfis de Acesso Comparativo

| Funcionalidade | Admin | Financeiro | Caixa | Consultor | Cliente |
|----------------|-------|-----------|-------|-----------|---------|
| Dashboard geral | ✅ | ✅ | ✅ | ✅ | — |
| CRUD Clientes | ✅ | ✅ | ver | ver carteira | — |
| Contratos | ✅ | ✅ | ver | ver carteira | ver próprios |
| Pagamentos | ✅ | ✅ | ✅ | — | via PIX |
| Caixa | ✅ | ✅ | ✅ | — | — |
| Relatórios | ✅ | ✅ | — | — | — |
| Reparcelamento | ✅ | ✅ | — | solicitar | — |
| Intenções | ✅ | ✅ | — | criar | — |
| Score de risco | ✅ | ✅ | — | ver | — |
| Chat interno | ✅ | ✅ | ✅ | ✅ | — |
| Auditoria | ✅ | — | — | — | — |
| Configurações | ✅ | — | — | — | — |
| Usuários | ✅ | — | — | — | — |
| Portal próprio | — | — | — | — | ✅ |

---

## Segurança e Compliance

### Segurança Técnica
- ✅ HTTPS com TLS 1.3 obrigatório
- ✅ MFA disponível para todos os operadores
- ✅ JWT de curta duração (15min) com refresh automático
- ✅ Rate limiting (10 req/min no login)
- ✅ Bloqueio de conta após 5 tentativas falhas
- ✅ Auditoria completa de todas as ações
- ✅ Row Level Security no banco de dados
- ✅ Validação de entrada em todos os endpoints
- ✅ Senhas hasheadas com bcrypt rounds=12
- ✅ Secrets nunca expostos no frontend

### Conformidade LGPD
- ✅ Dados no Brasil (sa-east-1, São Paulo)
- ✅ Consentimento para notificações (`notificacoesEmail`)
- ✅ Soft-delete (inativação) para direito ao esquecimento
- ✅ Portal do cliente para acesso aos próprios dados
- ✅ Log de auditoria para rastreabilidade
- ⚠️ Política de privacidade — pendente publicação
- ⚠️ DPO formalmente designado — pendente

---

## Roadmap

### Próximas Implementações
| Prioridade | Feature |
|-----------|---------|
| 🔴 Alta | Geração de contratos em PDF com assinatura digital |
| 🔴 Alta | Política de privacidade e LGPD compliant no portal |
| 🟡 Média | Dashboard com gráficos (recharts) — evolução mensal, inadimplência |
| 🟡 Média | Exportação de relatórios em Excel e PDF |
| 🟡 Média | Notificações push (PWA) |
| 🟢 Baixa | App mobile (React Native) |
| 🟢 Baixa | Integração com bureaux de crédito (SPC/Serasa) |
| 🟢 Baixa | Multa automática (campo existe, aplicação manual) |

### Configurações Pendentes (Produção)
- [ ] `MP_ACCESS_TOKEN` — Mercado Pago real (produção)
- [ ] Evolution API — configurar instância WhatsApp real
- [ ] RLS Supabase — aplicar políticas via SQL Editor
- [ ] DPO designado — notificar ANPD

---

## Antes × Depois

| Situação | Antes | Depois |
|----------|-------|--------|
| Controle de contratos | Planilhas Excel | Sistema web em tempo real |
| Cálculo de juros | Manual (erros) | Automatizado com Decimal.js |
| Notificações | WhatsApp manual | Automático (email + WA + portal) |
| Inadimplência | Descoberta tardia | Monitoramento diário às 08h |
| Rastreabilidade | Zero | Auditoria completa de toda ação |
| Acesso do cliente | Ligação/WhatsApp | Portal 24/7 com PIX |
| Reparcelamento | Acordo verbal | Fluxo digital com aceite formal |
| Score de crédito | Inexistente | Score interno atualizado em tempo real |
| Segurança | Senha única | MFA + JWT + RLS + bcrypt |

---

*SIAFI 2.0 — Desenvolvido com NestJS + Next.js · Infraestrutura Supabase + Redis · Deploy Windows Server 2022*
*Versão 2.0 · Maio 2026 · Lidera Tecnologia e Gestão*
