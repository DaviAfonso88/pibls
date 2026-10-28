# PoC de desempenho e inventário da conta HostGator (T012 a T015)

> **Gate da Fase 2.** Nada de schema, módulos ou frontend começa antes de a ADR-005 ficar **Aceita** (`tasks.md`, T014). Este runbook leva da conta HostGator vazia ao número que decide. O código da PoC (T013) já está pronto e foi verificado localmente; falta rodá-lo **na conta**, sem OPcache.

## O que será decidido

| Medida | Critério | Se passar | Se falhar |
|---|---|---|---|
| p95 de `GET /api/poc/read` com 10 requisições concorrentes (Eloquent + join + Resource; `php artisan optimize`; classmap autoritativo; sem OPcache) | **≤ 500 ms** | ADR-005 → **Aceita** no `architecture.md`; TBD-05 → Resolved | Abrir a ADR do **plano B (Slim 4 + Eloquent/PDO)** e **parar** (ver T014) |

Ensaio local, só como referência (Docker, Apache + mod_php, sem OPcache, mesma otimização): **p95 = 418 ms**, p99 = 628 ms, 68 req/s, 0% de falha. Já fica perto do limite numa máquina de desenvolvimento, então o resultado na hospedagem compartilhada não é uma formalidade.

## 1. Inventário da conta (T012)

Colete antes da PoC, porque os limites mudam como o resultado deve ser lido. Registre cada item em `docs/to-be-determined.md` (TBD-01, TBD-02 e TBD-04), e o que não tiver resposta fica como "não informado pelo suporte".

| O quê | Onde olhar | Alimenta |
|---|---|---|
| Nome do servidor e família (`br00`/`sh-pro00` = MySQL 5.7; `sh0000`/`rs000`/`sh-pro00000` = 8.0) | cPanel, painel direito ("Informações do servidor") | TBD-01 |
| Versão exata do MySQL | phpMyAdmin, rodapé ou `SELECT VERSION();` | TBD-01 |
| PHP 8.4 disponível e extensões (`pdo_mysql`, `mbstring`, `openssl`, `sodium`, `gd` com WebP, `fileinfo`, `curl`, `zip`, `intl`, `bcmath`) | "Selecionar versão do PHP" | `pibls:doctor` |
| `memory_limit`, `upload_max_filesize`, `post_max_size`, `max_execution_time` | "MultiPHP INI Editor" | TBD-02 (mínimos desejados: 256M, 12M, 13M, 60) |
| OPcache: está desligado? | Ver a seção 4, passo 8 | ADR-005 |
| **Entry processes**, CPU, memória, inodes, disco, processos simultâneos | cPanel → "Uso de recursos" / "Estatísticas" | TBD-02 |
| E-mails por hora | Suporte HostGator ou documentação do plano | TBD-02 |
| **Intervalo mínimo do cron** | "Tarefas Cron": criar uma tarefa de teste a cada minuto e conferir se o cPanel aceita | TBD-02 (assume 5 min) |
| Caminho do PHP 8.4 na linha de comando | `/usr/local/bin/ea-php84` (o formato que o cPanel exemplifica em "Tarefas Cron"); teste com um cron `/usr/local/bin/ea-php84 -v > ~/php-versao.txt` | cron da PoC |
| Datacenter, SLA e **termos sobre testes de carga** | Suporte HostGator / contrato | TBD-04 e TBD-02 |

Peça ao suporte, por escrito, a confirmação de que um teste de carga curto (10 requisições concorrentes por 60 s) é permitido. Guarde a resposta.

## 2. Onde rodar

Use o subdomínio **`homolog.pibls.com`**, que a T022 criaria de qualquer forma e é o **único** acréscimo previsto à zona DNS. Não rode contra `pibls.com`, que está servindo o WordPress.

1. cPanel → Domínios (ou Subdomínios): criar `homolog.pibls.com` com raiz em `homolog_html/` (`/home2/piblsc97/homolog_html/`). Em "MultiPHP Manager", marque **só** a linha do `homolog.pibls.com` e aplique **PHP 8.4 (ea-php84)**. Não altere `pibls.com`, que é o WordPress no ar (PHP 8.2).
2. Proteger com senha (cPanel → "Privacidade de diretório") e anotar usuário e senha: o `poc.js` aceita `AUTH=usuario:senha`.
3. Banco de dados descartável: cPanel → "Bancos de dados MySQL": criar `piblsc97_pibls_poc` e um usuário com todos os privilégios nele.

## 3. Gerar o pacote (na sua máquina)

```bash
docker compose up -d
bash load/poc-build.sh          # gera load/poc-package/poc-release.tar.gz (~4,5 MB)
docker compose exec app php artisan key:generate --show   # copie o valor: é o APP_KEY da PoC
```

O pacote leva o `vendor` de produção (sem dev, classmap autoritativo) e **não leva `.env`**. O `load/poc-package/` não vai para o git.

## 4. Subir e preparar na conta

Pelo Gerenciador de Arquivos do cPanel (ou FTPS). A conta é `piblsc97` e a home é **`/home2/piblsc97`** (cPanel → "Diretório Inicial"); não use `/home/...`.

1. Criar a pasta `/home2/piblsc97/private/` (ela não existe na conta; fica fora do `public_html`, então a web não a serve), enviar `poc-release.tar.gz` para ela e **extrair** em `/home2/piblsc97/private/pibls-poc/`.
2. Copiar o conteúdo de `pibls-poc/public/` para `/home2/piblsc97/homolog_html/`.
3. Editar `homolog_html/index.php`: em cada uma das **3** ocorrências de `__DIR__.'/../` (modo de manutenção, `vendor/autoload.php` e `bootstrap/app.php`), trocar por `'/home2/piblsc97/private/pibls-poc/`. Exemplo:
   ```php
   require '/home2/piblsc97/private/pibls-poc/vendor/autoload.php';
   $app = require_once '/home2/piblsc97/private/pibls-poc/bootstrap/app.php';
   ```
   Deixe o `.htaccess` do Laravel como está.
4. Criar `/home2/piblsc97/private/pibls-poc/.env`, permissão 600:
   ```dotenv
   APP_NAME=PIBLS-PoC
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=<valor do key:generate --show>
   APP_URL=https://homolog.pibls.com
   LOG_CHANNEL=single
   LOG_LEVEL=error
   DB_CONNECTION=mysql
   DB_HOST=localhost
   DB_PORT=3306
   DB_DATABASE=piblsc97_pibls_poc
   DB_USERNAME=<usuário do banco>
   DB_PASSWORD=<senha do banco>
   CACHE_STORE=file
   SESSION_DRIVER=file
   QUEUE_CONNECTION=sync
   ```
5. Dar escrita a `storage/` e `bootstrap/cache/` (775 em diretórios).
6. **Cron de uso único** (sem SSH). Em "Tarefas Cron", criar uma tarefa a cada minuto com o comando abaixo, aguardar 2 minutos, **conferir o arquivo de saída e apagar a tarefa**:
   ```text
   cd /home2/piblsc97/private/pibls-poc && /usr/local/bin/ea-php84 artisan poc:setup --rows=200 > /home2/piblsc97/poc-setup.txt 2>&1 && /usr/local/bin/ea-php84 artisan optimize >> /home2/piblsc97/poc-setup.txt 2>&1
   ```
   A saída deve trazer "PoC pronta: 200 grupos" e `config`, `events`, `routes` e `views` como DONE. O PHP é o `/usr/local/bin/ea-php84`; se o teste com `-v` da seção 1 não mostrar 8.4, use o caminho que funcionar (ex.: `/opt/cpanel/ea-php84/root/usr/bin/php`).
7. Conferir no navegador (ou `curl -u usuario:senha https://homolog.pibls.com/api/poc/read`): JSON com `data` e 50 itens.
8. **Conferir o OPcache.** Crie `homolog_html/opcache-check.php` com o conteúdo abaixo, abra a URL, **apague o arquivo em seguida**:
   ```php
   <?php header('Content-Type: text/plain');
   var_dump(function_exists('opcache_get_status') ? @opcache_get_status(false) : 'extensão ausente');
   var_dump(ini_get('opcache.enable'));
   var_dump(php_sapi_name());
   ```
   Esperado pela página de compatibilidades da HostGator: `false` ou `'extensão ausente'`. Mas o `ea-php84 -m` da conta já lista o Zend OPcache, então pode vir um array, e o `opcache.enable` mostra se está ligado no PHP web (no CLI ele vem desligado por padrão). Anote também o `php_sapi_name()` (`cgi-fcgi`, `litespeed`, `apache2handler`...), que diz se cada requisição sobe um processo PHP novo. Se estiver **ligado**, o resultado ficaria melhor que o da produção prevista (ADR-005 assume sem OPcache): anote e desative-o em "MultiPHP INI Editor" para a medição.

## 5. Medir (T014)

Rode em horário de baixo movimento, **3 vezes**, com 5 minutos entre elas. Cada execução: 5 s de aquecimento (fora da medida) e 60 s com 10 usuários concorrentes.

```bash
# k6 instalado:
k6 run -e BASE_URL=https://homolog.pibls.com -e AUTH=usuario:senha load/poc.js

# ou sem instalar nada (Windows/Git Bash: export MSYS_NO_PATHCONV=1 antes):
docker run --rm -v "$PWD/load:/load" -w /load grafana/k6 run \
  -e BASE_URL=https://homolog.pibls.com -e AUTH=usuario:senha poc.js
```

O resumo imprime p95, p99, média, máximo, requisições, taxa de falha e o **RESULTADO**, e grava `load/poc-resultado.json` (fora do git). Como ler:

- O **critério é o p95** da execução mediana das 3. Registre as três.
- **p99 alto ou erros 508/503** (aviso "ATENÇÃO" do script) indicam fila por limite de *entry processes*, mesmo com o p95 dentro. Não reprova sozinho, mas leva o assunto ao TBD-02 antes de aceitar a ADR.
- **Limites do plano P** (TBD-02): 25% de CPU por 90 s ou mais, 25 processos simultâneos e 25 conexões MySQL. Os 10 usuários sem pausa do `poc.js` mantêm o PHP ocupado o tempo todo, então, se o p95 passar de 500 ms, compare com o "Uso de recursos" do cPanel (CPU e *entry processes*) para separar lentidão do PHP de teto da conta. Cada execução dura cerca de 65 s, abaixo da janela de 90 s: não aumente o `DURATION`.
- Falha por 401/403: confira `AUTH`. Falha por 500: veja `private/pibls-poc/storage/logs/laravel.log`.

## 6. Registrar o resultado (T014)

Criar `docs/adr/0005-laravel-13-php-84.md` com: contexto, o ambiente medido (servidor, PHP 8.4, OPcache desligado, MySQL), os p95/p99 das 3 execuções, o inventário da seção 1 e a decisão. Depois:

| Resultado | Ações |
|---|---|
| **p95 ≤ 500 ms** | `architecture.md`: ADR-005 → **Aceita**. `to-be-determined.md`: TBD-05 → Resolved, com data e valor. A Fase 2 segue (T015 em diante) |
| **p95 > 500 ms** | Abrir a ADR do plano B (**Slim 4 + Eloquent/PDO**; a numeração tem de ser conferida, porque a T167 também reserva a ADR-019) e **parar**. Nenhum módulo começa |

## 7. Limpeza (T015)

Na conta: `php artisan poc:setup --drop` (outro cron de uso único), depois apagar `private/pibls-poc/`, o conteúdo de `homolog_html/` da PoC e o banco `piblsc97_pibls_poc`. O `homolog_html/` será reaproveitado pela T022.

No repositório, remover: `backend/routes/poc.php`, `backend/app/Poc/`, `backend/database/migrations/2026_10_21_000000_create_poc_tables.php`, `backend/tests/Feature/Poc/`, o gancho `then:` e o `withCommands` de `bootstrap/app.php`. Ficam só `load/poc.js` e `load/poc-build.sh`, como referência.
