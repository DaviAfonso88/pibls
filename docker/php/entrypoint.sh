#!/bin/sh
set -e

# Bind mount do Windows/macOS: storage/ e bootstrap/cache/ chegam como root (755) e o Apache,
# que roda como www-data, precisa gravar logs, views compiladas e sessões em arquivo.
if [ -d storage ] && [ -d bootstrap/cache ]; then
    chmod -R a+rwX storage bootstrap/cache 2>/dev/null || true
fi

exec docker-php-entrypoint "$@"
