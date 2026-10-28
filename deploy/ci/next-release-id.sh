#!/usr/bin/env bash
# Define o id da release (CalVer AAAA.MM.N, DevOps → Decisões). Numa tag v2026.11.3 o id é o da tag; nos demais casos,
# o ano e o mês de hoje (UTC) e o número da execução do workflow, que só cresce.
#
# Saída (GITHUB_OUTPUT): release_id
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

ref="${GITHUB_REF:-}"
if [[ "$ref" == refs/tags/v* ]]; then
  release_id="${ref#refs/tags/v}"
else
  release_id="$(date -u +%Y.%m).${GITHUB_RUN_NUMBER:?GITHUB_RUN_NUMBER não definido}"
fi

if ! printf '%s' "$release_id" | grep -Eq '^[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]{1,5}$'; then
  log "::error::Id de release inválido: ${release_id} (esperado AAAA.MM.N; a tag deve ser vAAAA.MM.N)."
  exit 1
fi

set_output release_id "$release_id"
log "Release: ${release_id}"
