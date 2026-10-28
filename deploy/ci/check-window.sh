#!/usr/bin/env bash
# Janela de deploy em produção (DevOps → Decisões): segunda a quarta, das 9h às 18h, America/Sao_Paulo.
# Fora dela só passa com HOTFIX=true e uma justificativa.
#
# Variáveis: HOTFIX (true|false), JUSTIFICATION (texto), DEPLOY_NOW (data para teste, ex.: "2026-11-02 10:00 -0300").
set -euo pipefail

now="${DEPLOY_NOW:-now}"
day_of_week="$(TZ=America/Sao_Paulo date -d "$now" +%u)" # 1 = segunda … 7 = domingo
hour="$(TZ=America/Sao_Paulo date -d "$now" +%H)"
local_time="$(TZ=America/Sao_Paulo date -d "$now" '+%a %Y-%m-%d %H:%M')"

if [ "$day_of_week" -ge 1 ] && [ "$day_of_week" -le 3 ] && [ "$((10#$hour))" -ge 9 ] && [ "$((10#$hour))" -lt 18 ]; then
  echo "Dentro da janela de deploy (seg–qua, 9h–18h): ${local_time} (America/Sao_Paulo)."
  exit 0
fi

justification="$(printf '%s' "${JUSTIFICATION:-}" | tr -d '[:space:]')"
if [ "${HOTFIX:-false}" = "true" ] && [ -n "$justification" ]; then
  echo "::warning::Deploy FORA da janela (${local_time}), liberado como hotfix. Justificativa: ${JUSTIFICATION}"
  exit 0
fi

echo "::error::Fora da janela de deploy (seg–qua, 9h–18h, America/Sao_Paulo): agora são ${local_time}. Para uma emergência, rode de novo com hotfix=true e a justificativa."
exit 1
