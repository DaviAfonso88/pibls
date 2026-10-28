#!/usr/bin/env bash
# Gera load/poc-package/poc-release.tar.gz: o backend pronto para subir na conta HostGator
# (PoC F0-03, T013/T014), sem SSH e sem Composer no servidor.
#
# Roda dentro do container `app`, numa cópia fora do bind mount, para NÃO mexer no vendor de
# desenvolvimento. O pacote leva o vendor de produção (sem dev, classmap autoritativo) e NÃO leva
# o .env: o .env da PoC é criado no servidor (ver docs/runbooks/poc-desempenho.md).
#
# Uso, a partir de qualquer pasta:  bash load/poc-build.sh
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="load/poc-package"
mkdir -p "$OUT"

docker compose up -d --wait app >/dev/null

docker compose exec -T app sh -ec '
  rm -rf /tmp/poc-build /tmp/poc-release.tar.gz
  mkdir -p /tmp/poc-build
  cd /var/www/html
  tar cf - \
    --exclude=./.env --exclude=./vendor --exclude=./tests --exclude=./node_modules \
    --exclude=./storage/logs --exclude=./storage/framework/cache --exclude=./storage/framework/sessions \
    --exclude=./storage/framework/views --exclude=./bootstrap/cache \
    . | tar xf - -C /tmp/poc-build
  cd /tmp/poc-build
  mkdir -p storage/logs storage/framework/cache/data storage/framework/sessions storage/framework/views bootstrap/cache
  composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --classmap-authoritative --no-progress
  tar czf /tmp/poc-release.tar.gz -C /tmp/poc-build .
'

docker compose cp app:/tmp/poc-release.tar.gz "$OUT/poc-release.tar.gz"
echo "Pacote gerado: $OUT/poc-release.tar.gz ($(du -h "$OUT/poc-release.tar.gz" | cut -f1))"
