#!/bin/bash
# SIAFI 2.0 — Deploy Script (Linux/servidor de produção)
# Uso: bash deploy.sh [backend|frontend|all|migrate]
#
# Pré-requisitos no servidor:
#   - Node.js 20+ (LTS)
#   - npm 10+
#   - PM2: npm install -g pm2
#   - MySQL 8+ com banco siafi_v2 criado
#   - Nginx instalado e configurado

set -e

SIAFI_DIR="/opt/siafi"
BACKEND_DIR="$SIAFI_DIR/backend"
FRONTEND_DIR="$SIAFI_DIR/frontend"
LOG_DIR="/var/log/siafi"

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

check_prereqs() {
    command -v node >/dev/null 2>&1 || err "Node.js não encontrado. Instale Node.js 20+."
    command -v npm >/dev/null 2>&1  || err "npm não encontrado."
    command -v pm2 >/dev/null 2>&1  || err "PM2 não encontrado. Execute: npm install -g pm2"
    log "Pré-requisitos OK (Node $(node -v), npm $(npm -v))"
}

setup_dirs() {
    mkdir -p "$LOG_DIR"
    mkdir -p "$BACKEND_DIR/uploads/clients"
    chmod 755 "$BACKEND_DIR/uploads"
}

deploy_backend() {
    log "=== Deploy Backend (NestJS) ==="
    cd "$BACKEND_DIR"

    log "Instalando dependências..."
    npm ci --omit=dev

    log "Gerando Prisma Client..."
    npx prisma generate

    log "Executando migrations..."
    npx prisma migrate deploy

    log "Compilando TypeScript..."
    npm run build

    log "Reiniciando serviço via PM2..."
    pm2 restart siafi-api 2>/dev/null || pm2 start "$SIAFI_DIR/ecosystem.config.js" --only siafi-api --env production

    log "Backend OK → http://localhost:4010/api"
}

deploy_frontend() {
    log "=== Deploy Frontend (Next.js) ==="
    cd "$FRONTEND_DIR"

    log "Instalando dependências..."
    npm ci --omit=dev

    log "Build de produção..."
    npm run build

    log "Reiniciando serviço via PM2..."
    pm2 restart siafi-web 2>/dev/null || pm2 start "$SIAFI_DIR/ecosystem.config.js" --only siafi-web --env production

    log "Frontend OK → http://localhost:4011"
}

run_migration() {
    log "=== Migração de dados: sistema_financeiro → siafi_v2 ==="
    warn "Certifique-se que o backend NestJS está parado antes de migrar."
    cd "$BACKEND_DIR"
    npm run migrate
    log "Migração concluída."
}

save_pm2() {
    log "Salvando configuração PM2..."
    pm2 save
    log "Configure inicialização automática: pm2 startup"
}

case "${1:-all}" in
    backend)  check_prereqs; setup_dirs; deploy_backend; save_pm2 ;;
    frontend) check_prereqs; setup_dirs; deploy_frontend; save_pm2 ;;
    migrate)  run_migration ;;
    all)
        check_prereqs
        setup_dirs
        deploy_backend
        deploy_frontend
        save_pm2
        log ""
        log "=== Deploy completo! ==="
        log "Backend:  http://localhost:4010/api"
        log "Frontend: http://localhost:4011"
        log "Público:  https://financeiro.lidera.app.br"
        log ""
        log "Próximos passos:"
        log "  1. Instale o Nginx config: cp $SIAFI_DIR/nginx/siafi.conf /etc/nginx/sites-available/siafi"
        log "  2. Ative:  ln -sf /etc/nginx/sites-available/siafi /etc/nginx/sites-enabled/siafi"
        log "  3. Teste:  nginx -t"
        log "  4. Aplique: systemctl reload nginx"
        ;;
    *)
        echo "Uso: $0 [backend|frontend|all|migrate]"
        exit 1
        ;;
esac
