# SIAFI 2.0 — Arquitetura

## Decisão: Monolito Modular vs Microsserviços

**Escolha: Monolito Modular**

NestJS com módulos bem delimitados. Cada módulo tem seu próprio controller, service, repository e DTOs. Comunicação entre módulos via injeção de dependência, não via HTTP.

**Por quê não microsserviços:**
- O SIAFI é um sistema financeiro de porte médio
- Complexidade operacional de microsserviços não se justifica
- Time pequeno, manutenção simples
- Pode ser extraído para microsserviços no futuro se necessário

---

## Fluxo de Requisição

```
Cliente (browser/mobile)
    │
    ▼
Next.js :4011
    │  Server Components → fetch() direto para NestJS
    │  Client Components → axios com JWT no header
    │
    ▼
Nginx (reverse proxy)
    │  /api/* → localhost:4010 (NestJS)
    │  /*     → localhost:4011 (Next.js)
    │
    ▼
NestJS :4010
    │
    ├── Guards: JwtAuthGuard → RolesGuard
    ├── Pipe: ValidationPipe (class-validator)
    ├── Interceptor: AuditInterceptor (log de ações)
    │
    ▼
Service → Repository → Prisma → MySQL
```

---

## Auth Flow (JWT)

```
1. POST /auth/login
   → valida credenciais → bcrypt.compare()
   → retorna { accessToken (15min), refreshToken (7d) }

2. Frontend armazena:
   → accessToken: memória (variável/estado)
   → refreshToken: httpOnly cookie

3. A cada request:
   → Authorization: Bearer <accessToken>

4. accessToken expirado:
   → Frontend detecta 401
   → POST /auth/refresh com refreshToken (cookie)
   → Recebe novo accessToken

5. Logout:
   → DELETE /auth/logout
   → Invalida refreshToken no banco (tabela refresh_tokens)
```

---

## Paginação Padrão

Todos os endpoints de listagem aceitam:
```
GET /clients?page=1&limit=20&search=joão&orderBy=nome&order=asc
```

Resposta padrão:
```json
{
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "lastPage": 8
  }
}
```

---

## Tratamento de Erros

```typescript
// GlobalExceptionFilter retorna sempre:
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["nome must not be empty"],
  "timestamp": "2026-05-18T10:00:00Z",
  "path": "/clients"
}
```

Nunca expor stack trace em produção (`NODE_ENV=production`).

---

## Banco de Dados

- MySQL (mesmo servidor do legado)
- Banco separado: `sistema_financeiro_v2` durante desenvolvimento
- Switch para banco de produção na Etapa 7 (migração de dados)
- Prisma Migrate para versionamento de schema
- Transações obrigatórias para operações multi-tabela

---

## Segurança

| Camada | Implementação |
|--------|--------------|
| Auth | JWT + httpOnly cookie para refresh |
| Autorização | RolesGuard + @Roles() decorator |
| Validação | class-validator em todos os DTOs |
| Rate limiting | @nestjs/throttler (login: 5/min, API: 100/min) |
| CORS | Somente origin do frontend |
| Headers | helmet.js |
| Uploads | Validação de MIME real (magic bytes) + extensão |
| SQL Injection | Prisma ORM (impossível com queries parametrizadas) |
| XSS | Sanitização no frontend (React escapa por padrão) |
