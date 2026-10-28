#!/usr/bin/env bash
# Espera o ativador responder em status/<id>.json (DevOps → Pipeline de CD, passos 4 e 6): consulta a cada 30 s, por até
# 15 min. Sai 0 quando a release ficou ativa; 1 se falhou ou se o tempo esgotou.
#
# Uso: wait-for-status.sh <release-id> [--rollback --since <ISO 8601>]
#   --rollback --since: só vale um status de rollback (via=rollback) atualizado depois do pedido. Sem isso, o
#   status "active" antigo da mesma release seria confundido com a resposta.
#
# Variáveis: WAIT_TIMEOUT_SECONDS (900), POLL_INTERVAL_SECONDS (30), STATUS_SOURCE_DIR (testes: lê desta pasta em vez
# do FTPS).
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

release_id="${1:?Uso: wait-for-status.sh <release-id> [--rollback --since <ISO 8601>]}"
shift || true
rollback=false
since=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --rollback) rollback=true ;;
    --since) since="${2:?--since exige uma data}"; shift ;;
    *) log "Argumento desconhecido: $1"; exit 2 ;;
  esac
  shift
done

timeout="${WAIT_TIMEOUT_SECONDS:-900}"
interval="${POLL_INTERVAL_SECONDS:-30}"
status_file="$(mktemp)"
trap 'rm -f "$status_file"' EXIT

fetch_status() {
  if [ -n "${STATUS_SOURCE_DIR:-}" ]; then
    cp "${STATUS_SOURCE_DIR}/${release_id}.json" "$status_file" 2>/dev/null
  else
    ftp_run "get status/${release_id}.json -o '${status_file}'" >/dev/null 2>&1
  fi
}

# Verdadeiro se a data ISO 8601 ($2) é igual ou posterior a ($1). Datas ISO em UTC ordenam como texto.
not_before() { [ "$(printf '%s\n%s\n' "$1" "$2" | LC_ALL=C sort | head -n1)" = "$1" ]; }

deadline=$((SECONDS + timeout))
last_state=""
while [ "$SECONDS" -lt "$deadline" ]; do
  if fetch_status && jq -e . "$status_file" >/dev/null 2>&1; then
    state="$(jq -r '.state // ""' "$status_file")"
    step="$(jq -r '.step // ""' "$status_file")"
    updated_at="$(jq -r '.updated_at // ""' "$status_file")"
    via="$(jq -r '.via // ""' "$status_file")"

    fresh=true
    if [ "$rollback" = true ]; then
      if [ "$via" != "rollback" ] && [ "$state" != "failed" ]; then fresh=false; fi
      if [ -z "$updated_at" ] || ! not_before "$since" "$updated_at"; then fresh=false; fi
    fi

    if [ "$fresh" = true ]; then
      if [ "$state" != "$last_state" ]; then log "Status de ${release_id}: ${state} (${step})"; last_state="$state"; fi
      case "$state" in
        active)
          log "Release ${release_id} ativa."
          exit 0
          ;;
        failed)
          echo "::error::A ativação de ${release_id} falhou na etapa '${step}': $(jq -r '.message // ""' "$status_file")"
          jq -r '.output_tail // empty' "$status_file" >&2
          exit 1
          ;;
      esac
    fi
  fi
  sleep "$interval"
done

echo "::error::Tempo esgotado (${timeout} s) esperando o ativador responder para ${release_id}. Confira o cron do cPanel e o heartbeat do Healthchecks."
exit 1
