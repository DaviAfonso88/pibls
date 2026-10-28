#!/usr/bin/env bash
# Confere GET /api/health depois da ativação (DevOps → Pipeline de CD, passo 5): 200, status ok e a release esperada.
# Tenta algumas vezes: o primeiro acesso após a troca do ponteiro pode pegar um processo PHP antigo.
#
# Uso: verify-health.sh <url-base> <release-id>      Variável opcional: BASIC_AUTH ("usuario:senha", só na homologação)
set -euo pipefail

base_url="${1:?Uso: verify-health.sh <url-base> <release-id>}"
release_id="${2:?Uso: verify-health.sh <url-base> <release-id>}"

curl_args=(--silent --show-error --max-time 20)
if [ -n "${BASIC_AUTH:-}" ]; then curl_args+=(--user "$BASIC_AUTH"); fi

for attempt in 1 2 3 4 5 6; do
  body="$(curl "${curl_args[@]}" --write-out '\n%{http_code}' "${base_url%/}/api/health" 2>/dev/null || true)"
  code="${body##*$'\n'}"
  json="${body%$'\n'*}"

  if [ "$code" = "200" ] && [ "$(printf '%s' "$json" | jq -r '.status // ""')" = "ok" ] && [ "$(printf '%s' "$json" | jq -r '.release // ""')" = "$release_id" ]; then
    echo "Health OK: release ${release_id} respondendo em ${base_url}."
    exit 0
  fi

  echo "Tentativa ${attempt}/6: HTTP ${code} ${json}" >&2
  sleep "${HEALTH_RETRY_SECONDS:-10}"
done

echo "::error::${base_url}/api/health não respondeu 200 com a release ${release_id}."
exit 1
