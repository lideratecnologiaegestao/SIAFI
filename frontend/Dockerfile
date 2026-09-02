# Frontend do SIAFI (Next.js 16) para rodar em contêiner na OCI.

FROM node:22-alpine AS build
WORKDIR /app

# ⚠️ TUDO QUE COMEÇA COM `NEXT_PUBLIC_` É EMBUTIDO NO BUNDLE, NO BUILD.
# Não adianta passar por `env_file` no compose: quando o contêiner sobe, o
# JavaScript do navegador já foi gerado com o valor que existia aqui. Errar um
# destes produz uma imagem que sobe sem reclamar e um site que chama a API
# errada — falha que só aparece no navegador do usuário.
ARG NEXT_PUBLIC_API_URL=https://2wm.siafi.app.br/api
ARG NEXT_PUBLIC_URL=https://2wm.siafi.app.br
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_URL=$NEXT_PUBLIC_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# `output: 'standalone'` no next.config.ts é o que gera esta pasta. Sem ele o
# `.next/standalone` não existe e o COPY abaixo falha — por isso a opção foi
# acrescentada junto com este arquivo, e não deve ser removida sem trocar o
# Dockerfile também.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 4011
ENV PORT=4011
CMD ["node", "server.js"]
