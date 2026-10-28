#!/usr/bin/env bash
# Abre as issues de lembrete da rotina de manutenção (T202; architecture.md → DevOps → Rotina de manutenção).
# Chamado pelo workflow `lembretes.yml`, no dia 1 de cada mês. Cada issue leva o checklist de `deploy/lembretes/<tipo>.md`.
#
#   mensal      todo mês (checklist curto)
#   anual       fevereiro (janela de atualização; inclui o teste de restauração, o kit e os acessos)
#
# Operação enxuta (ADR-021): os lembretes trimestral e semestral deixaram de existir. Para voltar ao roteiro completo,
# recrie `deploy/lembretes/trimestral.md` e `semestral.md` e as duas linhas `case` abaixo.
#
# Variáveis: TIPOS (ex.: "mensal,anual"; vazio = os do mês), MES (MM) e ANO (AAAA) para simular outra data,
# DRY_RUN=1 só imprime o que abriria, LEMBRETES_DIR (padrão: deploy/lembretes). Precisa de `gh` e GH_TOKEN fora do DRY_RUN.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
dir="${LEMBRETES_DIR:-${root}/deploy/lembretes}"
mes="${MES:-$(date -u +%m)}"
ano="${ANO:-$(date -u +%Y)}"
tipos="${TIPOS:-}"

if [ -z "${tipos}" ]; then
  tipos="mensal"
  case "${mes}" in 02) tipos="${tipos},anual" ;; esac
fi

for tipo in ${tipos//,/ }; do
  arquivo="${dir}/${tipo}.md"
  if [ ! -f "${arquivo}" ]; then
    echo "::error::Não existe o checklist do lembrete '${tipo}' (${arquivo})." >&2
    exit 1
  fi

  titulo="Manutenção ${tipo}: ${ano}-${mes}"

  if [ -n "${DRY_RUN:-}" ]; then
    echo "abriria: ${titulo}"
    continue
  fi

  # Não duplica se o workflow for executado de novo no mesmo mês
  abertas="$(gh issue list --state open --search "\"${titulo}\" in:title" --json number --jq 'length')"
  if [ "${abertas}" != "0" ]; then
    echo "Já existe uma issue aberta: ${titulo}"
    continue
  fi

  gh label create manutencao --color 2A6C82 --description "Rotina de manutenção do portal" >/dev/null 2>&1 || true
  gh issue create --title "${titulo}" --body-file "${arquivo}" --label manutencao
done
