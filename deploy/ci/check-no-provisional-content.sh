#!/usr/bin/env bash
# Conteúdo provisório nunca vai para produção (T021): qualquer marcador TODO(TBD-…) nos dados iniciais do backend ou no
# conteúdo fixo do frontend bloqueia o deploy. Na homologação o marcador é permitido (é onde a Secretaria revisa).
#
# Uso: check-no-provisional-content.sh [pasta…]   (padrão: backend/database/data frontend/app/content)
set -uo pipefail

if [ "$#" -gt 0 ]; then directories=("$@"); else directories=(backend/database/data frontend/app/content); fi

found=0
for directory in "${directories[@]}"; do
  [ -d "$directory" ] || continue
  if matches="$(grep -rnF 'TODO(TBD-' "$directory" 2>/dev/null)"; then
    found=1
    printf '%s\n' "$matches" | while IFS= read -r line; do echo "::error::Conteúdo provisório: ${line}"; done
  fi
done

if [ "$found" -ne 0 ]; then
  echo "::error::Há conteúdo provisório (TODO(TBD-…)) que ainda depende de resposta da TBD-11. Resolva antes de publicar em produção."
  exit 1
fi

echo "Nenhum marcador TODO(TBD-…) em: ${directories[*]}"
