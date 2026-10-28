#!/usr/bin/env bash
# Envia o pacote por FTPS para inbox/ (DevOps → Pipeline de CD, passo 3): o pacote primeiro e o manifest.json POR
# ÚLTIMO, enviado com nome temporário e renomeado, para o ativador nunca ver um manifest pela metade.
#
# Uso: upload-release.sh <pasta com release-<id>.tar.gz e manifest.json> <release-id>
set -euo pipefail
# shellcheck source=lib.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

directory="${1:?Uso: upload-release.sh <pasta> <release-id>}"
release_id="${2:?Uso: upload-release.sh <pasta> <release-id>}"
package="release-${release_id}.tar.gz"

[ -f "${directory}/${package}" ] || { log "Não encontrei ${directory}/${package}."; exit 1; }
[ -f "${directory}/manifest.json" ] || { log "Não encontrei ${directory}/manifest.json."; exit 1; }

log "Enviando ${package} ($(du -h "${directory}/${package}" | cut -f1))…"
ftp_run "cd inbox; put -O . '${directory}/${package}' -o '${package}.part'; mv '${package}.part' '${package}'"

log "Enviando o manifest.json (por último)…"
ftp_run "cd inbox; put -O . '${directory}/manifest.json' -o manifest.json.part; mv manifest.json.part manifest.json"

log "Pacote enviado. O ativador roda a cada 5 minutos."
