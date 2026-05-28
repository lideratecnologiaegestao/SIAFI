# SIAFI — Handoff para Novo Servidor
**Data de geração:** 2026-05-24  
**De:** Claude Code (sessão anterior)  
**Para:** Claude Code (nova instância, novo servidor)

---

## Situação Geral

O sistema SIAFI 2.0 está funcional e em produção em `https://financeiro.lidera.app.br`. A migração foi feita do servidor antigo para este novo servidor. As funcionalidades do núcleo estão completas. Esta sessão anterior resolveu 3 problemas e deixou 1 pendência incerta.

---

## O que foi feito nesta sessão

### 1. Correção de tela branca ao expirar sessão

**Problema:** Ao expirar a sessão, a tela ficava branca (white screen).  
**Causa raiz:** O layout `(dashboard)/layout.tsx` fazia `return null` enquanto o redirect assíncrono ainda não tinha disparado.  
**Solução aplicada:**

- [frontend/src/app/(dashboard)/layout.tsx](frontend/src/app/(dashboard)/layout.tsx) — Substituído `return null` por um spinner com `<Loader2>`. O redirect para login agora inclui `?redirect=<pathname>` para retornar à página original após login.
- [frontend/src/hooks/use-session-recovery.ts](frontend/src/hooks/use-session-recovery.ts) — Novo arquivo. Hook que escuta `visibilitychange` do browser e faz probe em `/auth/me` ao reativar a aba. Se a sessão expirou, o interceptor do axios detecta e dispara `tokenStore.onAuthLost → setUser(null) → redirect`.
- [frontend/src/contexts/auth.context.tsx](frontend/src/contexts/auth.context.tsx) — `tokenStore.onAuthLost` configurado para fazer SOMENTE `setUser(null)`. `window.location.replace` foi tentado e **removido** — causava loop de redirect.
- [frontend/src/lib/api.ts](frontend/src/lib/api.ts) — **Mantido como estava originalmente.** Uma tentativa de excluir todas as rotas `/auth/*` do interceptor de 401 foi revertida, pois quebrou o refresh transparente no `init()`.
- [frontend/src/app/(auth)/login/page.tsx](frontend/src/app/(auth)/login/page.tsx) — O parâmetro `?redirect=` agora é aplicado para todos os roles (era só para `cliente`). Funções `safeRedirect()` e `getRedirectParam()` validam o redirect (deve começar com `/`).

**Status:** Implementado e deployado. O usuário não confirmou explicitamente que o problema foi resolvido (mudou de assunto para o problema de PDFs). **Verificar se está funcionando.**

---

### 2. Correção de contraste em /documentacao

**Problema:** A página `/documentacao` usava cores hardcoded `slate-*` que eram ilegíveis no tema claro.  
**Solução:** [frontend/src/app/(dashboard)/documentacao/page.tsx](frontend/src/app/(dashboard)/documentacao/page.tsx) — Todos os `slate-*` substituídos por tokens shadcn/ui: `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`, `bg-accent`, `text-accent-foreground`.

---

### 3. Correção da geração de PDFs (CRÍTICO)

**Problema:** Nenhum PDF estava sendo gerado — todos falhavam silenciosamente.  
**Duas causas independentes:**

#### Causa A — Links diretos sem JWT (frontend)
Os botões de download usavam `<a href="/api/export/...">`, que abre sem o token JWT → backend retorna 401.

**Arquivos corrigidos:**
- [frontend/src/app/(dashboard)/relatorios/page.tsx](frontend/src/app/(dashboard)/relatorios/page.tsx) — Todos os links `href="/api/export/..."` convertidos para chamadas programáticas `api.get(endpoint, { responseType: 'blob' })` via funções `exportarPdf()` e `exportarExcel()`.
- [frontend/src/app/(dashboard)/clientes/[id]/page.tsx](frontend/src/app/(dashboard)/clientes/%5Bid%5D/page.tsx) — Idem. Função `baixarPdf()` adicionada no topo do arquivo.

#### Causa B — Chrome não encontrado pelo serviço NSSM (backend)
O NSSM executa o serviço como usuário diferente (`SYSTEM` ou outro), que não tem acesso ao cache do Puppeteer em `C:\Users\Administrator\.cache\puppeteer`.

**Arquivo corrigido:**
- [backend/src/modules/pdf/pdf.service.ts](backend/src/modules/pdf/pdf.service.ts) — Método `gerarBuffer()` agora enumera caminhos explícitos do Chrome:
  ```typescript
  const candidatos = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-148.0.7778.167\\chrome-win64\\chrome.exe',
    'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe',
  ].filter(Boolean) as string[];
  const executablePath = candidatos.find(p => existsSync(p));
  ```
  Você pode adicionar mais versões se necessário, ou configurar `PUPPETEER_EXECUTABLE_PATH` no `.env`.

---

## Estado atual dos serviços

Após as correções, o deploy foi executado:
```powershell
sc.exe stop SIAFI-API; npm run build (backend); sc.exe start SIAFI-API
sc.exe stop SIAFI-WEB; npm run build (frontend); sc.exe start SIAFI-WEB
```

---

## Pendências e próximos passos

### Verificar (não confirmado pelo usuário)

1. **Tela branca ao expirar sessão** — testar manualmente: logar, esperar o token expirar (~15min), voltar à aba. Deve aparecer spinner e redirecionar para `/login?redirect=/dashboard`.

2. **PDFs** — testar todos os endpoints:
   - `/export/carteira` → Relatório de Carteira
   - `/export/clientes/:id/extrato` → Extrato do Cliente
   - `/export/contratos/:id/pdf` → Contrato de Empréstimo
   - `/export/pagamentos/:id/recibo` → Recibo de Pagamento

   Se ainda não funcionar, verificar qual versão do Chrome está instalada:
   ```powershell
   dir "C:\Users\Administrator\.cache\puppeteer\chrome\" -Directory
   ```
   E adicionar o caminho ao array `candidatos` em `pdf.service.ts`, ou setar `PUPPETEER_EXECUTABLE_PATH` no `backend/.env`.

### Próximas implementações (CLAUDE.md §Estado Atual)

Funcionalidades listadas em "Próximas Implementações" que ainda não foram iniciadas:

1. **Dashboard com gráficos** — evolução mensal de pagamentos e inadimplência usando `recharts`. Os dados brutos já existem nos endpoints `/api/reports/carteira` e `/api/reports/faturamento`.

2. **Notificações push (PWA)** — Service Worker + Web Push API.

3. **Multa por atraso automática** — O campo `taxa_multa` já existe no schema Prisma (`taxaMulta` no model `Loan`). A multa é mencionada nos contratos PDF mas não é aplicada automaticamente nas parcelas atrasadas. Precisaria de um cron job que calcule e some a multa ao saldo devedor das parcelas `atrasado`.

4. **Supabase RLS** — Aplicar as policies via SQL Editor (instruções no CLAUDE.md §Estado Atual).

---

## Arquitetura e convenções críticas

Ver `CLAUDE.md` na raiz do projeto para a referência completa. Pontos que causaram problemas anteriores:

- **Formulários:** usar `zodResolver(schema) as any` (Zod v4 + react-hook-form têm incompatibilidade de tipos)
- **Downloads autenticados:** SEMPRE usar `api.get(url, { responseType: 'blob' })`, NUNCA `<a href="/api/...">` direto
- **Score de risco:** sempre `void this.scoreRisco.recalcularScore(clientId)` (fire-and-forget, nunca propagar erro)
- **Rotas estáticas antes de `:id`:** no NestJS, ex: `/badge` antes de `/conversas/:id`
- **Supabase Realtime:** cast necessário `'postgres_changes' as any`
- **tokenStore.onAuthLost:** apenas `setUser(null)` — NUNCA `window.location.replace` (causa loop)

---

## Estrutura dos serviços Windows

```
SIAFI-API  → D:\LIDERA\SIAFI\backend   (porta 4010) — produção, início automático
SIAFI-WEB  → D:\LIDERA\SIAFI\frontend  (porta 4011) — produção, início automático
SIAFI-API-DEV → manual (desenvolvimento)
SIAFI-WEB-DEV → manual (desenvolvimento)
```

Deploy padrão após alterações:
```powershell
# Backend
sc.exe stop SIAFI-API
cd D:\LIDERA\SIAFI\backend && npm run build
sc.exe start SIAFI-API

# Frontend
sc.exe stop SIAFI-WEB
cd D:\LIDERA\SIAFI\frontend && npm run build
sc.exe start SIAFI-WEB
```

---

## Variáveis de ambiente pendentes de configuração

No novo servidor, verificar se os `.env` estão configurados. Os que ainda precisam ser configurados para produção plena:

- `backend/.env`:
  - `MP_ACCESS_TOKEN` — Mercado Pago real (atualmente pode estar em sandbox)
  - `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`, `WHATSAPP_INSTANCE` — Evolution API
  - `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` — SMTP Hostinger (`smtp.hostinger.com:465`, SSL, `nao-responder@siafi.lidera.srv.br`)
  - `PUPPETEER_EXECUTABLE_PATH` — opcional, se o Chrome não for encontrado automaticamente

---

*Gerado em 2026-05-24 pela sessão Claude Code anterior.*
