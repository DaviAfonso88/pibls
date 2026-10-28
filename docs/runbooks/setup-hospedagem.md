# Setup da hospedagem e do repositório

> Registro do que foi configurado fora do código. Cada seção entra com a task que a executa. Origem: `architecture.md` → DevOps e Infrastructure.

## 1. GitHub: repositório, branch protection e 2FA (T011)

**Status: pendente de execução pelo responsável.** O procedimento está pronto; falta o repositório existir no GitHub e alguém com permissão de administrador aplicá-lo.

### 1.1 Repositório

1. Criar o repositório **privado** `pibls` (monorepo: `frontend/`, `backend/`, `deploy/`, `docs/`).
2. Neste diretório: `git init -b main`, primeiro commit (Conventional Commits) e `git push -u origin main`.
3. Conferir que `.env`, `.claude/settings.local.json` e `testsprite_tests/tmp/` **não** foram para o índice (`git status` antes do commit).

### 1.2 2FA

- Ativar a autenticação em dois fatores na conta do responsável (Settings → Password and authentication) e guardar os códigos de recuperação no kit de contingência (T155).
- Se o repositório estiver numa organização: Settings → Authentication security → **Require two-factor authentication**.

### 1.3 Branch protection em `main`

Settings → Branches → Add branch ruleset (ou *branch protection rule*) para `main`:

| Opção | Valor |
|---|---|
| Require a pull request before merging | Ligado (sem push direto) |
| Require status checks to pass before merging | Ligado, com **Require branches to be up to date** |
| Status checks obrigatórios | `Frontend (tsc, ESLint, Prettier, Vitest)`, `Backend (PHP 8.4 sem OPcache, MySQL 5.7)`, `Backend (PHP 8.4 sem OPcache, MySQL 8.0)`, `Segurança (audit e Semgrep CE)` |
| Block force pushes | Ligado |
| Restrict deletions | Ligado |
| Do not allow bypassing the above settings | Ligado (vale também para o administrador) |

Os checks só aparecem na lista depois de o `ci.yml` rodar uma vez, então abra um PR de teste antes. O job `a11y-perf` entra como obrigatório quando a T052 o criar.

### 1.4 Dependabot

O `.github/dependabot.yml` já está no repositório. Conferir em Settings → Code security que **Dependabot alerts** e **Dependabot security updates** estão ligados.

## 2. HostGator: homologação, banco, pastas e cron (T022)

**Status: pendente de execução pelo responsável.** O código que este procedimento instala está pronto e testado (`deploy/finalize.php`, `deploy/templates/*`, `deploy/htaccess/*`); falta a conta HostGator receber os passos abaixo. Faça primeiro a **homologação** e só depois repita para a produção, trocando `pibls-homolog` por `pibls`, `homolog_html` por `public_html` e os nomes de banco.

Convenção: `USUARIO` é o usuário da conta (o prefixo que o cPanel acrescenta, ex.: `piblsc97`); a home é `/home2/USUARIO` ou `/home/USUARIO` (cPanel → "Diretório Inicial"). `<app>` é `pibls-homolog` ou `pibls`.

> **O que NÃO se altera:** MX, SPF, DKIM e nameservers. O único acréscimo à zona DNS é o registro A do subdomínio `homolog`, que o cPanel cria sozinho (ADR-017). `pibls.com` continua servindo o WordPress até o cutover.

### 2.1 Subdomínio de homologação

1. cPanel → **Domínios** → criar `homolog.pibls.com` com raiz em `homolog_html/` (sem redirecionar).
2. cPanel → **MultiPHP Manager**: marcar **só** a linha do `homolog.pibls.com` e aplicar o **PHP 8.4 (ea-php84)**. Não mexer em `pibls.com`.
3. cPanel → **MultiPHP INI Editor** (para o domínio de homologação): `memory_limit = 256M`, `upload_max_filesize = 12M`, `post_max_size = 13M`, `max_execution_time = 60`. O `pibls:doctor` confere.
4. cPanel → **Privacidade de diretório** na pasta `homolog_html`: ligar a proteção por senha (HTTP Basic) e anotar usuário e senha; o E2E de fumaça e o health check do deploy usam o par (`BASIC_AUTH`). O cPanel escreve a proteção no `.htaccess` do docroot; o ativador preserva essas linhas.
5. O `noindex` da homologação já vem no `.htaccess` do projeto (cabeçalho `X-Robots-Tag` para o host `homolog.pibls.com`).
6. Conferir o TLS (AutoSSL) do subdomínio: `https://homolog.pibls.com` deve abrir sem aviso.

### 2.2 Banco de dados (um por ambiente)

cPanel → **Bancos de dados MySQL**:

| O quê | Produção | Homologação |
|---|---|---|
| Banco | `USUARIO_pibls_prod` | `USUARIO_pibls_homolog` |
| Usuário da aplicação (**só DML**: SELECT, INSERT, UPDATE, DELETE) | `USUARIO_pibls_app` | `USUARIO_pibls_happ` |
| Usuário das migrations (**DDL + DML**, usado só pelo ativador) | `USUARIO_pibls_migr` | `USUARIO_pibls_hmigr` |

1. Criar os dois usuários de cada ambiente, com senhas longas e diferentes.
2. "Adicionar usuário ao banco": o `*_app` com **SELECT, INSERT, UPDATE, DELETE**; o `*_migr` com **todos os privilégios** (precisa de CREATE, ALTER, DROP, INDEX, REFERENCES…).
3. O MySQL só aceita conexão local: **não** liberar hosts em "MySQL remoto".
4. Anotar a versão do MySQL (phpMyAdmin, rodapé) em `to-be-determined.md` (TBD-01).

### 2.3 Pastas do ambiente

No Gerenciador de Arquivos (ou FTP), dentro de `/home/USUARIO/`, crie (permissão 755 nas pastas):

```text
private/
├── bin/                         ← scripts compartilhados pelos dois ambientes
└── <app>/
    ├── releases/
    ├── shared/
    │   └── storage/
    │       ├── app/
    │       ├── framework/{cache,sessions,views}/
    │       └── logs/
    └── deploy/
        ├── inbox/
        ├── status/
        └── lock/
homolog_html/                    ← já criada no passo 2.1  (produção: public_html/)
├── uploads/{boletins,eventos,pix}/
└── data/
```

Instalar os arquivos do repositório (uma vez; só mudam em manutenção):

| Do repositório | Para o servidor | Observação |
|---|---|---|
| `deploy/finalize.php` | `private/bin/finalize.php` | O ativador. Atualize a cópia quando ele mudar (não faz parte do pacote da release). |
| `deploy/templates/artisan.php` | `private/bin/artisan.php` | Wrapper do artisan para o cron. |
| `deploy/templates/index.php` | `homolog_html/index.php` (e `public_html/index.php`) | **Na cópia da homologação, troque `$app = 'pibls'` por `'pibls-homolog'`.** |
| `deploy/htaccess/uploads.htaccess` | `homolog_html/uploads/.htaccess` | O ativador nunca toca em `uploads/`. |
| `deploy/templates/env.example` | `private/<app>/shared/.env` | Preencha os campos marcados com ⚠ (próximo passo). |

O `.htaccess` do docroot **não** é copiado à mão: o primeiro deploy cria o bloco do projeto (entre as linhas `BEGIN`/`END` do arquivo `deploy/htaccess/public_html.htaccess`) ao lado do que o cPanel já escreveu.

### 2.4 `.env` do ambiente

1. Copiar `deploy/templates/env.example` para `private/<app>/shared/.env` e **mudar a permissão para 600**.
2. Gerar a `APP_KEY` no seu computador (`php artisan key:generate --show`, com o ambiente local do Docker) e colar. Guardar uma cópia no kit de contingência (T155): sem ela, os campos cifrados não abrem.
3. Preencher: `APP_URL`, `DB_*` (usuário `*_app`), `DB_MIGRATOR_*` (usuário `*_migr`), `MAIL_*` (SMTP da conta, porta 465), `UPLOADS_PATH` e `SNAPSHOTS_PATH` (caminhos absolutos para `uploads/` e `data/` do docroot do ambiente), `PIX_ALERT_RECIPIENTS`.
4. **Só na homologação**: `API_DOCS_ENABLED=true` e `MAIL_ALLOWLIST=` com os e-mails da equipe de teste (sem isso, a homologação poderia escrever para o público).
5. `FEATURE_EVENTS=false` no R1.

### 2.5 FTPS restrito ao ambiente

cPanel → **Contas FTP**: uma conta por ambiente, com o diretório inicial em `/home/USUARIO/private/<app>/deploy` (ela enxerga só `inbox/` e `status/`). Senha forte. Anotar host, usuário e senha para os Secrets do GitHub (`FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`). Exigir TLS explícito: o `lftp` do CI recusa conexão sem TLS.

### 2.6 Cron

cPanel → **Tarefas Cron**: criar as quatro tarefas de `deploy/templates/cron.txt` (ativador e agendador, produção e homologação), a cada 5 minutos, ajustando o caminho do PHP 8.4 (`/usr/local/bin/ea-php84` costuma ser o certo; teste com uma tarefa de uso único `ea-php84 -v > ~/php-versao.txt`). Se o cPanel só aceitar um intervalo maior que 5 min, use o mínimo permitido e registre em TBD-02: as latências do e-mail e da ativação sobem na mesma proporção.

### 2.7 Segredos e ambientes no GitHub

Settings → **Environments**:

| Environment | Secrets | Variáveis | Proteção |
|---|---|---|---|
| `homolog` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, `BASIC_AUTH` (`usuario:senha` da privacidade de diretório) | `SITE_URL` = `https://homolog.pibls.com` | nenhuma (deploy automático) |
| `production` | `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` | `SITE_URL` = `https://pibls.com` | **Required reviewers**: o responsável pelo projeto; "Prevent self-review" desligado (aprovador único, ver Risk Register) |

Variável do repositório: `VITE_SENTRY_DSN` (DSN público do projeto do frontend no Sentry, TBD-07; pode ficar vazia no começo).

Variáveis do repositório da medição de uso (GoatCounter, ADR-022; podem ficar vazias até o go-live, e então o site não carrega script nenhum): crie a conta em goatcounter.com (o "código" vira o endereço `https://<código>.goatcounter.com`) e preencha `VITE_ANALYTICS_SRC` = `https://gc.zgo.at/count.js` e `VITE_ANALYTICS_ENDPOINT` = `https://<código>.goatcounter.com/count`. Em Settings da conta GoatCounter, deixe desligada a coleta de dados de localização por cidade e confira que "Data collection" não guarda o IP. Depois do primeiro deploy, abra o site, navegue duas páginas e veja os acessos no painel do GoatCounter (a visita local, em `localhost`, não é contada).

### 2.8 Primeiro deploy e conferência

1. Faça um push em `main` com o CI verde: o workflow **Deploy** monta o pacote, envia para a homologação e espera o ativador (até 5 min de cron + o tempo das migrations).
2. Na falha, abra `private/pibls-homolog/deploy/status/<release>.json` (etapa e saída do erro) e `private/pibls-homolog/shared/storage/logs/finalize-AAAA-MM-DD.log`.
3. Depois de ativa: `https://homolog.pibls.com/api/health` deve devolver `{"status":"ok","release":"…"}`.
4. Para o diagnóstico do ambiente, a qualquer momento, crie uma tarefa de uso único em Tarefas Cron: `ea-php84 /home/USUARIO/private/bin/artisan.php pibls-homolog pibls:doctor > /home/USUARIO/doctor.txt 2>&1`, leia o arquivo e **apague a tarefa e o arquivo**.
5. Ensaie 3 deploys e 3 rollbacks e registre os tempos em `docs/runbooks/rollback.md` (T023).

## 3. Serviços externos: UptimeRobot, Healthchecks, Sentry e Backblaze B2 (T152)

> **Operação enxuta (ADR-021): comece por `operacao-enxuta.md`.** Ela cobre o mínimo (B2 com a chave privada, 2 checks do Healthchecks, 1 monitor do UptimeRobot e um kit simples) em cerca de 1 hora. Nesta seção, **§3.4 (B2) é obrigatório**; §3.1 e §3.2 valem na versão reduzida (1 monitor e 2 checks); **§3.3 (Sentry) e §3.5 (resumo diário) são opcionais**. O restante abaixo é o roteiro completo, para religar depois.

**Status: pendente de execução pelo responsável.** O código está pronto e testado; cada serviço abaixo precisa de uma conta criada por uma pessoa (login e, no B2, cartão). Conferir os **planos gratuitos** antes (TBD-07): uso **não comercial** do UptimeRobot e do Healthchecks, e a exigência de cartão no B2. Anote em cada item a data em que conferiu e o plano. **Todos os valores abaixo vão só no `.env` do servidor, nunca no repositório.**

### 3.1 UptimeRobot (queda, certificado e disponibilidade mensal)

Plano gratuito, **intervalo de 5 minutos**. Crie 3 monitores:

| Monitor | Tipo | Alvo | Condição |
|---|---|---|---|
| Site | **Keyword** | `https://pibls.com/` | Palavra fixa do rodapé: `Política de Privacidade` (alerta se **não existir**) |
| API | **Keyword** | `https://pibls.com/api/health` | Palavra `"status":"ok"` (alerta se **não existir**); HTTP 200 |
| Certificado | **SSL expiry** (em *Alert Contacts*/monitor de HTTP com a opção de validade) | `pibls.com` | Alerta com **menos de 14 dias** |

**Contatos de alerta**: o responsável (e-mail **e** push, pelo aplicativo do UptimeRobot) e **um membro da liderança, só por e-mail** (ciência, para avisar a igreja). Em *Settings → API*, crie uma **chave só de leitura** (*Read-only API key*): ela vai em `UPTIMEROBOT_API_KEY` e serve ao resumo mensal (disponibilidade do mês). Sem ela, a linha só fica "não consultada".

### 3.2 Healthchecks.io (cron parado, backup e e-mail)

Crie **um projeto** e **cinco checks** (plano gratuito: 20). Cada URL (`https://hc-ping.com/<uuid>`) vai em uma variável do `.env`:

| Check | Período e tolerância | Variável | Quem pinga |
|---|---|---|---|
| Worker de e-mail | 5 min, tolerância **15 min** | `HEALTHCHECKS_PING_URL` | O agendador, a cada execução do `queue:work` |
| Dump do banco | 1 h, tolerância **30 min** | `HEALTHCHECKS_BACKUP_DB_URL` | `pibls:backup:db` |
| Cópia externa (B2) | 1 dia, tolerância **2 h** | `HEALTHCHECKS_BACKUP_OFFSITE_URL` | `pibls:backup:offsite` |
| Expurgo LGPD | 1 dia, tolerância **2 h** | `HEALTHCHECKS_PURGE_URL` | `pibls:retention:purge` |
| Falhas de e-mail | 15 min, tolerância **30 min** | `HEALTHCHECKS_MAIL_URL` | `pibls:mail:failure-check` (`/fail` com mais de 10 falhas em 1 h) |

O **finalizador de deploy** (período 5 min, tolerância 15 min) também ganha um check, se o ativador estiver configurado para pingar. Fuso do check do backup externo: **America/Sao_Paulo**, com agenda diária às **03:30**.

Em *Integrations*: **e-mail e push** (aplicativo) do responsável para todos os checks. Os alertas dos checks de backup e e-mail **não passam pelo SMTP do portal**, de propósito: ele pode ser justamente o que quebrou. Timeout do ping: 5 s, uma nova tentativa (já no código); falha no ping nunca para a tarefa.

### 3.3 Sentry (erros, região UE)

1. Crie a organização na região **UE** (a escolha não se muda depois) e **dois projetos**: `pibls-backend` (PHP/Laravel) e `pibls-frontend` (React).
2. DSN do backend em `SENTRY_LARAVEL_DSN` (`.env` do servidor). DSN do frontend na variável do repositório `VITE_SENTRY_DSN` (GitHub → Settings → Variables). O DSN do frontend é público por desenho.
3. Em *Settings → Security & Privacy*: **Prevent Storing of IP Addresses** ligado e **Data Scrubber** ligado. O código já remove corpo de requisição, cookies e cabeçalhos de autenticação (`before_send`) e não envia dado pessoal: a conferência é um teste, não uma promessa. Gere um erro de teste em homologação e abra o evento: **não pode ter e-mail, telefone nem mensagem**.
4. Alertas: **e-mail** do responsável para *new issue*. Triagem no mesmo dia útil.

### 3.4 Backblaze B2 (cópia dos backups fora da hospedagem)

1. Conta B2, com **2FA**. Crie o **bucket privado** na região **UE (Amsterdã)**, sem versionamento público. Anote o *endpoint* S3 (`https://s3.eu-central-003.backblazeb2.com`) e a região (`eu-central-003`).
2. **Regras de ciclo de vida** do bucket (Lifecycle Settings), por prefixo: `db/daily/` apagar **35 dias** depois de enviado; `db/monthly/` **365 dias**; `uploads/` **sem expiração**.
3. Crie **duas chaves de aplicação** (*App Keys*), ambas restritas a este bucket:
   - **Chave de gravação do servidor**: permissões **listar e gravar**, **sem exclusão** (nem `deleteFiles`). Vai no `.env`: `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `B2_REGION`, `B2_ENDPOINT`. Se ela vazar, ninguém apaga os backups.
   - **Chave de leitura para restaurar**: só **ler e listar**. Fica **no kit de contingência** (`kit-de-contingencia.md`), nunca no servidor.
4. **Par de chaves dos backups**, na **sua máquina** (não no servidor): `php artisan pibls:backup:keygen`. A linha `BACKUP_PUBLIC_KEY=…` vai no `.env` do servidor; a `BACKUP_PRIVATE_KEY=…` vai **somente** para o KeePassXC do kit. **Sem a privada, os backups não abrem.**
5. No `.env` da **produção**: `BACKUPS_ENABLED=true`. Na **homologação** e no local: `false` (não gera backup nem manda cópia).
6. Teste ponta a ponta (uma vez, em produção, com uma tarefa cron de uso único, apagando-a depois): `ea-php84 /home/USUARIO/private/bin/artisan.php pibls pibls:backup:db` e, em seguida, `… pibls:backup:offsite`. Conferir: arquivo cifrado em `private/pibls/shared/storage/backups/`, objetos `db/daily/AAAA-MM-DD.sql.gz.enc` e `uploads/…` no bucket, e os dois checks verdes no Healthchecks.
7. **Teste de restauração** com a chave de leitura e a privada: `restaurar-backup.md` (T154).

### 3.5 Resumo diário por e-mail

No `.env` da produção: `DAILY_REPORT_RECIPIENTS=` com o e-mail do responsável (e, se quiserem receber o mensal, o de um membro da liderança) e `GO_LIVE_DATE=AAAA-MM-DD` (as semanas do SC-006 contam daí). O resumo sai às 07:00 de São Paulo, pela fila de e-mail. Confira que chegou no primeiro dia e que **nenhum dado pessoal** aparece nele.

### 3.6 Checklist de conferência do T152

| Item | Feito em | Plano / observação |
|---|---|---|
| UptimeRobot: 1 monitor da página inicial (completo: 3) e os contatos de alerta | | |
| UptimeRobot: chave só de leitura em `UPTIMEROBOT_API_KEY` | | |
| Healthchecks: 2 checks, worker e cópia externa (completo: 5), e os alertas | | |
| Sentry (opcional): projetos na UE, DSNs, evento de teste sem PII | | |
| B2: bucket, ciclo de vida, chave sem exclusão, chave de leitura no kit | | |
| Par de chaves dos backups gerado fora do servidor; privada só no kit | | |
| `BACKUPS_ENABLED=true` só na produção; teste do dump e da cópia | | |
| Resumo diário (opcional) recebido, sem dado pessoal | | |

## Próximas seções

- Cutover e go-live: T164 e T165. O roteiro do primeiro go-live no plano P, no lugar do WordPress e com publicação manual do pacote (ADR-024), está em `publicar-na-hostgator.md`.
