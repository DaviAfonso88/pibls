# Publicar o novo portal na HostGator (plano P), no lugar do WordPress

> Roteiro do **primeiro go-live**, do zero, na conta que hoje serve o WordPress em `pibls.com`. Junta, na ordem de execução, o que está em `setup-hospedagem.md` §2, `operacao-enxuta.md`, `provisionar-usuario.md` e no plano de cutover do `architecture.md`. Publicação **sem GitHub Actions**: o pacote é montado na sua máquina (`deploy/empacotar-local.sh`, ADR-024) e instalado pelo mesmo ativador do servidor.
> Ensaio feito em 2026-10-25 num servidor simulado (banco vazio, `.env` de produção, `finalize.php` real): a release ativou e o `/api/health` respondeu `{"status":"ok"}`.

**Convenções.** `USUARIO` é o usuário da conta no cPanel (o prefixo dos bancos, ex.: `piblsc97`). A home é `/home2/USUARIO` nesta conta (servidor `br702`; confira em cPanel → "Diretório inicial"). O PHP 8.4 do cron é `/usr/local/bin/ea-php84`.

**O que nunca se mexe:** nameservers, zona DNS (MX, SPF, DKIM), as contas de e-mail e as pastas `mail/`, `etc/` e `public_html/.well-known/` e `public_html/cgi-bin/`.

| Fase | Onde | Afeta o site no ar? | Tempo |
|---|---|---|---|
| 0. Preparar na sua máquina | Docker | Não | 30 min |
| 1. Backup do WordPress | cPanel | Não | 20 min |
| 2. Preparar a conta | cPanel | Não | 1 h |
| 3. Troca (cutover) | cPanel | **Sim, ~10 min fora do ar** | 30 min |
| 4. Usuários do painel | phpMyAdmin | Não | 15 min |
| 5. Conteúdo pelo painel | Painel | Não | variável |
| 6. Conferência | Navegador | Não | 30 min |
| 7. Remover o WordPress | cPanel | Não | **30 dias depois** |

## 0. Na sua máquina

1. Suba o ambiente: `docker compose up -d`.
2. Rode os testes, já que o CI não vai rodá-los por você:
   - `cd frontend && npm run typecheck && npm run lint && npm run test && npm run build && npm run bundle:check`
   - Pest por pasta, nunca em paralelo: `docker compose exec app php -d memory_limit=1G ./vendor/bin/pest tests/Feature/Access` (repita para cada pasta de `tests/`), mais `./vendor/bin/pint --test` e `./vendor/bin/phpstan analyse`.
3. Gere e guarde num arquivo temporário seguro (vão para o `.env` do servidor e para o cofre):
   - a chave da aplicação: `docker compose exec app php artisan key:generate --show`;
   - o par de chaves dos backups: `docker compose exec app php artisan pibls:backup:keygen`. A linha `BACKUP_PRIVATE_KEY` **nunca** vai para o servidor.
4. Monte o pacote, no Git Bash e na raiz do repositório: `bash deploy/empacotar-local.sh 2026.10.1`. Saem `deploy/.release-local/out/release-2026.10.1.tar.gz` (~15 MB) e `manifest.json`. A cada publicação nova, use o próximo número (`2026.10.2`, `2026.11.1`…).

## 1. Backup do WordPress (antes de tocar em qualquer coisa)

1. Abra `public_html/wp-config.php` no Gerenciador de Arquivos e anote o nome do banco do WordPress (`DB_NAME`). Ele **não** deve ser apagado agora.
2. cPanel → **Backup** → "Fazer download de um backup do diretório inicial" (ou só `public_html/`) e, em "Fazer download de um backup de banco de dados MySQL", o banco do WordPress. Guarde os dois **fora da hospedagem**.
3. cPanel → **Zone Editor** → exporte ou fotografe a zona de `pibls.com` (para conferir no fim que nada mudou).
4. Anote as tarefas que já existem em **Tarefas Cron** e o que há em `public_html/` além do WordPress, como arquivos `google*.html` de verificação do Search Console. Esses arquivos **ficam** no lugar.

## 2. Preparar a conta (o WordPress continua no ar)

### 2.1 Caixa de envio

cPanel → **Contas de e-mail** → criar `naoresponda@pibls.com` com senha forte. Em "Conectar dispositivos", anote as **configurações SSL/TLS seguras**: servidor de saída (o nome que aparece ali, ex.: `br702.hostgator.com.br` ou `mail.pibls.com`) e porta **465**.

### 2.2 Banco de dados

cPanel → **Bancos de dados MySQL**:

1. Criar o banco `USUARIO_pibls_prod`.
2. Criar dois usuários com senhas longas e diferentes: `USUARIO_pibls_app` e `USUARIO_pibls_migr`.
3. "Adicionar usuário ao banco": o `_app` só com **SELECT, INSERT, UPDATE, DELETE**; o `_migr` com **TODOS OS PRIVILÉGIOS**.
4. Não libere nada em "MySQL remoto".

O banco fica vazio: as tabelas, as 14 permissões, os 7 papéis, as configurações iniciais e os ministérios entram sozinhos pelas migrations na primeira ativação.

### 2.3 Pastas e arquivos fixos

No Gerenciador de Arquivos, ligue **Configurações → Mostrar arquivos ocultos** e crie em `/home2/USUARIO/` (pastas com permissão 755):

```text
private/
├── bin/
└── pibls/
    ├── releases/
    ├── shared/
    │   └── storage/
    │       ├── app/
    │       ├── framework/
    │       │   ├── cache/
    │       │   ├── sessions/
    │       │   └── views/
    │       └── logs/
    └── deploy/
        ├── inbox/
        ├── status/
        └── lock/
```

Envie do repositório:

| Do repositório | Para o servidor |
|---|---|
| `deploy/finalize.php` | `private/bin/finalize.php` |
| `deploy/templates/artisan.php` | `private/bin/artisan.php` |

### 2.4 O `.env` de produção

Crie `private/pibls/shared/.env` a partir de `deploy/templates/env.example` e mude a permissão para **600**. Preencha:

| Variável | Valor |
|---|---|
| `APP_KEY` | a do passo 0.3 |
| `APP_URL` | `https://pibls.com` |
| `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | `USUARIO_pibls_prod`, `USUARIO_pibls_app` e a senha dele |
| `DB_MIGRATOR_USERNAME`, `DB_MIGRATOR_PASSWORD` | `USUARIO_pibls_migr` e a senha dele |
| `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS` | o servidor SSL do 2.1, `naoresponda@pibls.com`, a senha da caixa, `naoresponda@pibls.com` |
| `MAIL_ALLOWLIST` | vazio (em produção) |
| `UPLOADS_PATH`, `SNAPSHOTS_PATH`, `SPA_FALLBACK_PATH` | troque `/home/USUARIO` por `/home2/USUARIO` nos três |
| `PIX_ALERT_RECIPIENTS` | e-mails da Tesouraria e da liderança, separados por vírgula. **Sem isso a ativação é recusada** (`pibls:doctor`) |
| `FEATURE_EVENTS` | `false` na primeira versão. Ligue depois, quando quiser publicar eventos |
| `BACKUPS_ENABLED` e `BACKUP_PUBLIC_KEY`, `B2_*` | ver 2.6. Se o B2 ainda não estiver pronto, `BACKUPS_ENABLED=false` |
| `API_DOCS_ENABLED`, `APP_DEBUG` | `false` |

### 2.5 PHP e cron

1. **Não troque ainda** a versão do PHP do `pibls.com`: o WordPress pode não rodar no 8.4. A troca é no passo 3.2.
2. cPanel → **Tarefas Cron** → crie só o ativador por enquanto (a cada 5 min, `*/5 * * * *`). Com a `inbox/` vazia, ele não faz nada:

   ```text
   /usr/local/bin/ea-php84 /home2/USUARIO/private/bin/finalize.php pibls > /dev/null 2>&1
   ```

### 2.6 Backup fora da hospedagem (recomendado antes do go-live)

Siga `operacao-enxuta.md`: Parte 1 (bucket B2 e chave sem exclusão no `.env`, `BACKUPS_ENABLED=true`) e Parte 2 (2 checks do Healthchecks e 1 monitor do UptimeRobot). O teste do backup (Parte 3) e o cofre (Parte 4) ficam para depois do go-live.

## 3. Troca: sai o WordPress, entra o portal

De preferência de segunda a quarta, das 9h às 18h, com 1 hora livre.

1. **Tirar o WordPress da raiz web, sem apagar.** Crie `/home2/USUARIO/wp_legacy/` e **mova** para ela todo o conteúdo de `public_html/`, **menos** `.well-known/`, `cgi-bin/` e os arquivos `google*.html`. O `.htaccess` e o `index.php` do WordPress vão junto. A partir daqui o site fica fora do ar.
2. cPanel → **MultiPHP Manager** → marque `pibls.com` → **PHP 8.4 (ea-php84)** → Aplicar. Isso grava o handler num `.htaccess` novo em `public_html/`; deixe as linhas que ele escreveu como estão.
3. cPanel → **MultiPHP INI Editor** → `pibls.com`: confira `memory_limit` ≥ 256M, `upload_max_filesize` ≥ 12M, `post_max_size` ≥ 13M e `max_execution_time` ≥ 60.
4. Em `public_html/`, crie `uploads/boletins/`, `uploads/eventos/`, `uploads/pix/` e `data/`, e envie:

   | Do repositório | Para o servidor |
   |---|---|
   | `deploy/templates/index.php` | `public_html/index.php` (sem mudar nada: `$app = 'pibls'`) |
   | `deploy/htaccess/uploads.htaccess` | `public_html/uploads/.htaccess` |

   Neste momento, `https://pibls.com` mostra "O site está em manutenção". É o esperado.
5. **Envie o pacote** para `private/pibls/deploy/inbox/`: primeiro o `release-2026.10.1.tar.gz` e, só depois de ele terminar, o `manifest.json`.
6. Espere até 5 min (o próximo cron) e abra `private/pibls/deploy/status/2026.10.1.json`. Deve estar `"state": "active"`. O ativador conferiu o pacote, rodou o `pibls:doctor` e as migrations, copiou o site para `public_html/`, juntou o bloco `# BEGIN pibls … # END pibls` ao `.htaccess` (preservando as linhas do cPanel) e gerou os snapshots em `public_html/data/`.
7. Abra `https://pibls.com/api/health`: deve responder `{"status":"ok","release":"2026.10.1"}`.
8. Agora crie a segunda tarefa cron, o agendador, que manda os e-mails da fila, gera snapshots e faz os backups (a cada 5 min):

   ```text
   /usr/local/bin/ea-php84 /home2/USUARIO/private/bin/artisan.php pibls schedule:run > /dev/null 2>&1
   ```

**Se o status vier `failed`:** o campo `step` diz onde parou (`doctor`, `migrate`…) e a saída do erro vem junto. O log completo fica em `private/pibls/shared/storage/logs/finalize-AAAA-MM-DD.log`. Corrija (quase sempre é o `.env`) e envie o pacote de novo com o mesmo id. **Para voltar ao WordPress** enquanto isso (≤ 15 min): devolva o PHP antigo no MultiPHP Manager, mova o conteúdo de `public_html/` para `public_html_novo/` (menos `.well-known/` e `cgi-bin/`) e traga de volta o de `wp_legacy/`.

## 4. Usuários do painel (no banco da HostGator)

A aplicação nunca cria usuários: eles entram pelo phpMyAdmin (BR-077). Os usuários de teste do Docker (`@pibls.test`) **não** existem em produção, e o seeder local se recusa a rodar lá.

1. **Hash da senha**, na sua máquina (no PowerShell; no Git Bash use `winpty` antes do `docker`):

   ```text
   docker compose exec app php artisan pibls:hash-password
   ```

   Ele pede a senha duas vezes, sem mostrar, confere a política (12+ caracteres, fora das senhas vazadas) e imprime só o hash `$2y$12$…`.
2. cPanel → **phpMyAdmin** → `USUARIO_pibls_prod` → aba **SQL**. Para **você, com todas as permissões** (os 6 papéis gerais somam as 14 permissões; o de líder seria redundante), rode as duas instruções juntas:

   ```sql
   INSERT INTO users (name, email, password, ministry_id, is_active, created_at, updated_at)
   VALUES ('<Seu Nome>', '<seu-email@exemplo.com>', '<hash $2y$12$…>', NULL, 1, NOW(), NOW());

   INSERT INTO user_permissions (user_id, role_code, permission_key)
   SELECT LAST_INSERT_ID(), role_code, permission_key
   FROM role_templates
   WHERE role_code IN ('COMUNICACAO', 'SECRETARIA', 'TESOURARIA', 'ORACAO', 'PASTORAL', 'ADMIN_TECNICO');
   ```

3. **Para cada pessoa da equipe**, a mesma coisa com **só o papel dela** (`WHERE role_code = 'SECRETARIA'`, por exemplo). A tabela de papéis, o líder de ministério (que precisa de `ministry_id`), a troca de papel e a desativação estão em `provisionar-usuario.md`.
4. Confira: `https://pibls.com/admin/entrar` → entre → o menu mostra os módulos do papel. Teste também "Esqueci minha senha": o e-mail sai pela fila em até 5 min. Se não chegar, veja `emails-nao-chegam.md`.

## 5. Conteúdo, pelo painel

O banco de produção começa com o conteúdo inicial das migrations (endereço, horários, links, ministérios e grupos). **Nada do banco do Docker vai junto**, então refaça pelo painel o que você ajustou localmente:

- **Configurações:** endereço, horários, WhatsApp, YouTube e, em "Link do mapa incorporado", o `src` do iframe do Google Maps (`https://www.google.com/maps/embed?pb=…`).
- **PIX:** chave e dados (Tesouraria). Os e-mails de `PIX_ALERT_RECIPIENTS` recebem o aviso de cada alteração.
- **Ministérios e grupos**, **Boletins** (com os PDFs) e **Palavra Viva**.

Fotos, logos e o retrato do pastor vão no pacote (vêm do build). Uma foto nova pede um pacote novo (fase 0.4).

## 6. Conferência (no mesmo dia)

- [ ] Páginas: Início, Quem somos (com a foto do pastor), Como chegar (mapa), Ministérios, Grupos, Boletins, Palavra Viva, Contribua, Privacidade e uma URL inexistente (página de não encontrado).
- [ ] Um envio de cada formulário (visitante, quero ser membro, pedido de oração, contato) aparece no painel e gera o e-mail de aviso.
- [ ] Painel: entrar, sair, um acesso por papel.
- [ ] **E-mail institucional intacto:** mande e receba uma mensagem em uma caixa `@pibls.com` já existente. A zona DNS é a mesma do passo 1.3.
- [ ] `https://pibls.com/api/health` com `ok`, e o UptimeRobot verde.
- [ ] Search Console: envie `https://pibls.com/sitemap.xml` e acompanhe os 404 por 7 dias. As URLs antigas do WordPress que tinham acesso ganham um 301 no bloco 3 de `deploy/htaccess/public_html.htaccess` (T158) e vão no próximo pacote.

## 7. Remover o WordPress (30 dias depois)

O WordPress fica em `wp_legacy/` por **30 dias** como caminho de volta (plano de cutover). Passado esse prazo, com o portal estável:

1. Confirme que os backups da fase 1 abrem.
2. Gerenciador de Arquivos: apague `wp_legacy/`.
3. cPanel → **Bancos de dados MySQL**: apague o banco do WordPress (o `DB_NAME` do passo 1.1) e o usuário MySQL dele. **Não** apague o `USUARIO_pibls_prod`.
4. Se o WordPress foi instalado pelo Softaculous ou pelo QuickInstall, remova também o registro da instalação lá, e apague as tarefas cron dele que você anotou no passo 1.4.
5. O backup arquivado do WordPress tem contatos de formulários antigos: **destrua-o 90 dias depois do go-live** (LGPD).

## Depois do go-live: atualizações

Cada versão nova: testes (fase 0.2) → `bash deploy/empacotar-local.sh <próximo id>` → envio para `inbox/` (pacote, depois manifest) → `status/<id>.json` e `/api/health`. Para voltar à versão anterior, veja `rollback.md`, caminho 2. Quando o repositório estiver no GitHub, o `deploy.yml` passa a fazer esse envio (ADR-024).

Para ensaiar antes num ambiente isolado, sem tocar no WordPress, `setup-hospedagem.md` §2 monta a homologação em `homolog.pibls.com`. O plano P aceita subdomínios.
