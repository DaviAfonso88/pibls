#!/usr/bin/env bash
# Funções comuns dos scripts de deploy (deploy/ci/*.sh). Não é executado sozinho: os outros scripts fazem `source`.
#
# Variáveis de ambiente (segredos do GitHub Environment, nunca da aplicação):
#   FTP_HOST      host do FTPS (pode levar :porta)
#   FTP_USER      usuário da conta restrita a private/<app>/deploy/
#   FTP_PASSWORD  senha dessa conta
#
# A conta FTP enxerga só a pasta deploy/ do ambiente: inbox/ (onde o CI grava) e status/ (onde o ativador responde).

# Roda comandos do lftp (separados por ";") em FTPS explícito, com verificação do certificado.
ftp_run() {
  : "${FTP_HOST:?FTP_HOST não definido}" "${FTP_USER:?FTP_USER não definido}" "${FTP_PASSWORD:?FTP_PASSWORD não definido}"
  lftp -u "${FTP_USER},${FTP_PASSWORD}" "ftp://${FTP_HOST}" -e \
    "set ftp:ssl-force true; set ftp:ssl-protect-data true; set ssl:verify-certificate yes; \
     set net:max-retries 3; set net:reconnect-interval-base 5; set net:timeout 30; $1; bye"
}

log() { printf '%s\n' "$*" >&2; }

# Escreve uma linha em $GITHUB_OUTPUT (ou na saída padrão, fora do Actions).
set_output() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; else printf '%s=%s\n' "$1" "$2"; fi
}
