#!/usr/bin/env bash
# Monta o pacote de release NA SUA MÁQUINA, com os mesmos passos do job "Build do pacote de release" do deploy.yml,
# para publicar sem o GitHub Actions: você envia o pacote pelo Gerenciador de Arquivos do cPanel e o ativador
# (finalize.php, no cron do servidor) instala do mesmo jeito que instalaria o do CI.
#
# Uso (Git Bash, na raiz do repositório, com `docker compose up -d` rodando):
#   bash deploy/empacotar-local.sh 2026.10.1
#
# O id é CalVer AAAA.MM.N e precisa ser novo a cada envio (2026.10.1, 2026.10.2…). Saída em deploy/.release-local/out/:
#   release-<id>.tar.gz   envie PRIMEIRO para private/pibls/deploy/inbox/
#   manifest.json         envie POR ÚLTIMO (é a presença dele que avisa o ativador que o upload terminou)
#
# O composer roda no container do projeto (PHP 8.4), numa cópia do backend: o vendor/ de desenvolvimento não muda.
# Não leva .env nem segredo (o gerador do pacote recusa). Conteúdo provisório (TODO(TBD-…)) bloqueia, como no CI.
set -euo pipefail

release_id="${1:-}"
if ! printf '%s' "$release_id" | grep -Eq '^[0-9]{4}\.(0[1-9]|1[0-2])\.[0-9]{1,5}$'; then
  echo "Uso: bash deploy/empacotar-local.sh <AAAA.MM.N>   (ex.: $(date +%Y.%m).1)" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="${root}/deploy/.release-local"
# A pasta deploy/ é montada no container em /var/www/deploy (docker-compose.yml)
container_work="/var/www/deploy/.release-local"
cd "$root"

echo "==> Conteúdo provisório"
bash deploy/ci/check-no-provisional-content.sh

echo "==> Frontend (react-router build)"
(cd frontend && VITE_RELEASE="$release_id" npm run build)

echo "==> Montando backend/ e spa/ em ${work}/stage"
rm -rf "$work"
mkdir -p "$work/stage/backend" "$work/stage/spa" "$work/out"

# Mesmas exclusões do CI, mais o que o checkout limpo do CI não teria: o vendor/ (reinstalado sem as dependências de
# desenvolvimento), o cache do bootstrap gerado aqui (lista pacotes de dev) e scripts soltos na raiz do backend
tar -C backend \
  --exclude=./tests --exclude=./storage --exclude=./public --exclude=./node_modules --exclude=./vendor \
  --exclude='./bootstrap/cache/*.php' --exclude='./*.mjs' \
  --exclude=./.env --exclude='./.env.*' --exclude=./.phpunit.cache --exclude=./.phpunit.result.cache \
  --exclude=./phpunit.xml --exclude=./phpstan.neon --exclude=./pint.json \
  --exclude=./README.md --exclude=./.editorconfig --exclude=./.gitattributes --exclude=./.gitignore \
  --exclude='./database/*.sqlite' \
  -cf - . | tar -C "$work/stage/backend" -xf -

cp -R frontend/build/client/. "$work/stage/spa/"
# O fallback da SPA (rotas do painel e 404) é o index.html do build quando o prerender ainda não o gerou
[ -f "$work/stage/spa/__spa-fallback.html" ] || cp "$work/stage/spa/index.html" "$work/stage/spa/__spa-fallback.html"
# Regras do Apache: o ativador mescla este bloco ao .htaccess do docroot
cp deploy/htaccess/public_html.htaccess "$work/stage/spa/.htaccess"

echo "==> Backend (composer sem dev, autoloader otimizado e classmap autoritativo)"
MSYS_NO_PATHCONV=1 docker compose exec -T -w "${container_work}/stage/backend" app \
  composer install --no-dev --no-interaction --no-progress --prefer-dist --optimize-autoloader --classmap-authoritative

test ! -e "$work/stage/backend/.env" || { echo "Erro: .env no pacote" >&2; exit 1; }
test -f "$work/stage/backend/vendor/autoload.php" || { echo "Erro: vendor/autoload.php não foi gerado" >&2; exit 1; }

echo "==> Pacote e manifest (SHA-256 de cada arquivo)"
MSYS_NO_PATHCONV=1 docker compose exec -T app \
  php /var/www/deploy/build-release-package.php "${container_work}/stage" "$release_id" "local" "${container_work}/out"

echo
echo "Pronto. Envie, nesta ordem, para private/pibls/deploy/inbox/ no servidor:"
echo "  1. ${work}/out/release-${release_id}.tar.gz"
echo "  2. ${work}/out/manifest.json"
