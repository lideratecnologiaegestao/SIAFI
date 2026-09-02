# API do SIAFI (NestJS 11 + Prisma 5) para rodar em contêiner na OCI.
#
# Duas coisas aqui não são convenção e quebram o build se mexidas sem cuidado:
# o Prisma e o Chromium. Cada uma tem o seu comentário no lugar onde importa.

FROM node:22-alpine AS build
WORKDIR /app

# ⚠️ O OPENSSL PRECISA EXISTIR JÁ NO BUILD, E NÃO É SÓ PARA COMPILAR.
# O `prisma generate` escolhe o engine pela plataforma que DETECTA no momento
# em que roda. Sem openssl aqui, ele detecta `linux-musl` (OpenSSL 1.1) e gera
# só esse engine; o estágio final tem OpenSSL 3 e exige
# `linux-musl-openssl-3.0.x`. O resultado é uma imagem que constrói sem um
# aviso e morre no arranque com "could not locate the Query Engine" — erro que
# parece de schema e é de camada.
RUN apk add --no-cache openssl

# ⚠️ O `prisma/` PRECISA VIR ANTES DO `npm ci`.
# O `package.json` tem `postinstall: prisma generate`, que roda DENTRO do
# `npm ci`. Sem o schema no disco nesse momento, o install falha com
# "Could not find schema.prisma" — e a mensagem culpa o Prisma, não a ordem
# das camadas, que é o que de fato está errado.
COPY package*.json ./
COPY prisma ./prisma

# O Chromium vem do apk (abaixo, no runtime), não do download do Puppeteer: o
# binário que ele baixa é glibc e não executa em Alpine (musl). Sem esta
# variável, `npm ci` baixa ~150 MB que só serviriam para falhar em tempo de
# execução.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# openssl → exigido pelo engine do Prisma; sem ele o cliente sobe e falha na
#   primeira query com "Unable to require libquery_engine".
# chromium + fontes → o módulo `pdf` usa Puppeteer para gerar PDF. `nss`,
#   `freetype` e `harfbuzz` são dependências do Chromium; `ttf-freefont` evita
#   PDF sem texto visível (fonte ausente rende retângulos vazios, e o PDF sai
#   "válido" — falha silenciosa que só aparece para o cliente).
# curl → só para baixar o cloudflared logo abaixo.
RUN apk add --no-cache openssl ca-certificates curl chromium nss freetype harfbuzz ttf-freefont

# cloudflared → embutido para alcançar o Redis central via Cloudflare Zero Trust.
# O entrypoint só o ativa quando REDIS_TUNNEL_EMBED=true; sem isso a imagem roda
# só o Node (HML/local, onde o Redis é local ou tem sidecar).
#
# ⚠️ A ARQUITETURA VEM DO BUILD, NÃO FIXA. Cravar `-amd64` faz uma imagem arm64
# baixar um binário x86 que só falha ao ser executado — build verde, contêiner
# que não sobe. `TARGETARCH` é preenchido pelo BuildKit (amd64|arm64) e casa com
# o nome dos releases do cloudflared.
ARG TARGETARCH
RUN curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${TARGETARCH} \
      -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared && cloudflared --version

# O Puppeteer procura o Chrome que ele mesmo baixaria. Como aqui ele vem do
# apk, é preciso dizer onde está — senão o serviço de PDF morre com
# "Could not find Chrome".
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

ARG APP_VERSION=
ARG GIT_SHA=
ENV APP_VERSION=$APP_VERSION GIT_SHA=$GIT_SHA

# entrypoint: sobe o cloudflared (se REDIS_TUNNEL_EMBED=true) e então o Node.
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

# Roda sem privilégio. O Chromium precisa de `--no-sandbox` quando o processo
# não é root em contêiner — quem chama o Puppeteer já passa essa flag.
USER node
EXPOSE 4010
CMD ["./docker-entrypoint.sh"]
