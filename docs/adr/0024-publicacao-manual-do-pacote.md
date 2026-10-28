# ADR-024 — Publicação manual do pacote de release enquanto o deploy pelo GitHub Actions não está disponível

- **Status:** Aceita
- **Data:** 2026-10-25 (decisão do responsável)

## Contexto

A ADR-010 define o deploy assim: o CI (GitHub Actions) monta o pacote, envia por FTPS para `private/<app>/deploy/inbox/` e o ativador (`finalize.php`, no cron do servidor) o instala. A regra do projeto é "build só no CI".

No momento do primeiro go-live, o repositório ainda não está no GitHub. Além disso, no plano **GitHub Free**, um repositório **privado** não tem *environments*, segredos de *environment* nem revisor obrigatório, e o `deploy.yml` depende dos três (`homolog` e `production`). Para usar o pipeline como está, seria preciso o GitHub Pro/Team (custo, contra o BG-1) ou um repositório público.

O ativador não depende de quem enviou o pacote: ele confere o `manifest.json`, o SHA-256 do pacote e de cada arquivo, roda o `pibls:doctor` e as migrations, e só então troca o ponteiro.

## Decisão

Enquanto o deploy pelo GitHub Actions não estiver configurado, a release pode ser montada **na máquina do responsável** por `deploy/empacotar-local.sh`, que repete os passos do job de build do `deploy.yml`:

- `check-no-provisional-content.sh`, `react-router build` e `composer install --no-dev --classmap-authoritative`, este último no container do projeto (PHP 8.4);
- as mesmas exclusões do CI, mais o `vendor/` de desenvolvimento, o cache do `bootstrap/` gerado localmente e scripts soltos;
- o mesmo `deploy/build-release-package.php`, com `git_sha = local`.

O pacote e o manifest vão para `inbox/` pelo **Gerenciador de Arquivos do cPanel**, o manifest por último. O ativador, o `.env` no servidor, as migrations com o usuário de DDL e o rollback seguem a ADR-010 sem mudança.

## Alternativas consideradas

- **GitHub Pro (US$ 4/mês) com o `deploy.yml` como está:** o caminho da arquitetura, mas tem custo recorrente (BG-1).
- **Repositório público no GitHub Free:** libera *environments* e segredos. O código não tem segredo, mas expor o código-fonte é uma decisão da igreja.
- **Trocar os segredos de *environment* por segredos do repositório:** funciona no Free privado, mas perde a aprovação manual da produção (o revisor obrigatório), que é a proteção da ADR-010.
- **Build no servidor:** descartado. O servidor não tem Node.js nem SSH.

## Consequências

- *Positivas:* o go-live não espera o GitHub; o pacote é o mesmo do CI e passa pelas mesmas conferências no ativador.
- *Negativas:* o build depende da máquina do responsável (Node 24, Docker); não rodam antes os testes do CI (Vitest, Pest, E2E, Semgrep), então rode-os à mão antes de empacotar; o `git_sha` do manifest não aponta para um commit; o envio é manual (não há espera do status nem verificação do `/api/health` automáticas).
- *A observar:* quando o repositório estiver no GitHub com uma das alternativas acima, voltar ao `deploy.yml` e deixar o empacotamento local só como contingência.
