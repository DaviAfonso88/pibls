#!/usr/bin/env bash
# Pede o rollback ao ativador (DevOps → Procedimento de rollback): grava inbox/rollback.json com a release de destino.
# Sem release informada, usa a anterior, que o ativador mantém em status/current.json.
#
# Uso: request-rollback.sh [release-id]
# Saídas (GITHUB_OUTPUT): release_id (o destino) e requested_at (ISO 8601 UTC).
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

target="${1:-}"

if [ -z "$target" ]; then
  current="$(mktemp)"
  trap 'rm -f "$current"' EXIT
  ftp_run "get status/current.json -o '${current}'" >/dev/null 2>&1 || { log "Não consegui ler status/current.json."; exit 1; }
  target="$(jq -r '.previous_release_id // ""' "$current")"
  [ -n "$target" ] || { log "Não há release anterior registrada: informe o release_id."; exit 1; }
  log "Release de destino (a anterior): ${target}"
fi

if ! printf '%s' "$target" | grep -Eq '^[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]{1,5}$'; then
  log "release_id inválido: ${target} (esperado AAAA.MM.N)."
  exit 1
fi

requested_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
request="$(mktemp)"
printf '{"release_id":"%s","requested_at":"%s","requested_by":"%s"}\n' "$target" "$requested_at" "${GITHUB_ACTOR:-manual}" > "$request"

ftp_run "cd inbox; put -O . '${request}' -o rollback.json.part; mv rollback.json.part rollback.json"
rm -f "$request"

set_output release_id "$target"
set_output requested_at "$requested_at"
log "Rollback para ${target} pedido. O ativador roda a cada 5 minutos."
