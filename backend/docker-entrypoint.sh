#!/bin/sh
# Entrypoint: opcionalmente sobe o cloudflared (Redis central via Cloudflare Zero
# Trust) ANTES do Node. Ativado por REDIS_TUNNEL_EMBED=true.
#
# POR QUE ISTO EXISTE: na OCI o Redis nao esta na mesma VM nem alcancavel pela
# rede interna (a 6379 esta bloqueada na security list). Os portais resolvem
# embutindo o cloudflared na propria imagem; o SIAFI foi migrado em 26/08 com
# REDIS_HOST=127.0.0.1:6390 copiado da maquina Windows, onde 6390 era um tunel
# LOCAL. Dentro do contentor, 127.0.0.1 e o proprio contentor: a fila ficou 6
# dias fora do ar (92 ECONNREFUSED/min) sem que nada aparentasse erro — o
# healthcheck e HTTP e continuou verde.
#
# Requer (so quando embutido): TUNNEL_SERVICE_TOKEN_ID / TUNNEL_SERVICE_TOKEN_SECRET
# (service token do Cloudflare Access), lidos automaticamente pelo cloudflared.
# A app conecta em REDIS_HOST=127.0.0.1 : REDIS_PORT.
#
# ⚠️ NAO usar variaveis chamadas PORT/HOST aqui: PORT ja e a porta do Nest e
# seria sobrescrita. Por isso RHOST/RPORT.
set -e

if [ "$REDIS_TUNNEL_EMBED" = "true" ]; then
  RHOST="${REDIS_TUNNEL_HOSTNAME:-redis.lidera.app.br}"
  RPORT="${REDIS_PORT:-6379}"
  echo "[entrypoint] cloudflared access tcp -> $RHOST (listener 127.0.0.1:$RPORT)"
  # loop de resiliencia: se o cloudflared cair, reinicia (a fila depende dele)
  (
    while true; do
      cloudflared access tcp --hostname "$RHOST" --url "127.0.0.1:$RPORT" || true
      echo "[entrypoint] cloudflared encerrou, reiniciando em 2s" >&2
      sleep 2
    done
  ) &
  # espera o listener local ficar de pe (ate ~30s) antes de subir o Node
  i=0
  until node -e "const s=require('net').connect(${RPORT},'127.0.0.1');s.setTimeout(1000);s.on('connect',()=>process.exit(0));s.on('timeout',()=>process.exit(1));s.on('error',()=>process.exit(1));" 2>/dev/null; do
    i=$((i + 1))
    if [ "$i" -ge 30 ]; then
      echo "[entrypoint] timeout aguardando o tunel; subindo o Node mesmo assim" >&2
      break
    fi
    sleep 1
  done
  echo "[entrypoint] tunel pronto"
fi

exec node dist/src/main
