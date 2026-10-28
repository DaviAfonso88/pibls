# Restaurar um backup

> Origem: `architecture.md` → Backup e Recovery, ADR-011 e I-09; Constituição VII: **um backup que nunca foi restaurado não é um backup**. **Metas: RTO ≤ 4 h e RPO ≤ 1 h** para falhas dentro da conta (o dump é de hora em hora), **≤ 24 h** se a conta ou o servidor da HostGator forem perdidos (a última cópia diária no B2).

## 1. O que existe, onde, e como se abre

| O quê | Onde | Idade máxima | Para abrir |
|---|---|---|---|
| Dumps do banco, de hora em hora | `private/pibls/shared/storage/backups/db-AAAAMMDD-HHMMSS.sql.gz.enc` (UTC), os de 48 h | 1 h | Chave privada |
| Cópia diária no B2 | bucket, `db/daily/AAAA-MM-DD.sql.gz.enc` (35 dias) | 24 h | Chave privada + chave de **leitura** do B2 |
| Cópia mensal no B2 | `db/monthly/AAAA-MM.sql.gz.enc` (12 meses) | 1 mês | Idem |
| Uploads (PDFs, banners) | bucket, `uploads/…` (sem expiração) | 24 h | Chave de leitura do B2 |

Tudo cifrado: **só a chave privada abre** (`BACKUP_PRIVATE_KEY`, no KeePassXC do kit de contingência: `kit-de-contingencia.md`). Sem ela, o backup é inútil. A chave nunca fica no servidor.

O dump **não tem os dados** das tabelas `sessions`, `cache` e `cache_locks` (só a estrutura): depois de restaurar, todo mundo precisa entrar de novo no painel, e nenhum token de sessão está nos backups.

## 2. Pré-requisitos (tenha tudo antes de precisar)

- A **chave privada** (kit) e uma **chave de leitura do B2** (kit).
- Uma máquina com este repositório e o Docker (`docker compose up -d`): é dela que sai o comando `php artisan pibls:backup:decrypt`.
- Para restaurar na produção: o cPanel (phpMyAdmin) e o FTP/Gerenciador de Arquivos.

## 3. Restaurar o banco (passo a passo)

### 3.1 Baixar o backup certo

- **Falha dentro da conta** (dado corrompido, exclusão acidental, migração com defeito): o dump **mais recente anterior ao problema**, de `backups/` (cPanel → Gerenciador de Arquivos → baixar) ou o diário do B2. Escolha pela hora: o nome é em UTC; São Paulo é UTC−3.
- **Perda da conta/servidor**: a cópia diária mais recente no B2 (painel do B2 → bucket → `db/daily/`, ou o `aws s3 cp` com `--endpoint-url`).

### 3.2 Abrir (na sua máquina)

```bash
cd backend   # ambiente local do Docker: docker compose exec app …
php artisan pibls:backup:decrypt "$HOME/Downloads/db-20261023-172207.sql.gz.enc" --key-file="$HOME/chave-privada-backups.txt"
# grava $HOME/Downloads/db-20261023-172207.sql.gz
```

Se a chave estiver errada: *"A chave privada não abre este backup."* Se o arquivo veio cortado ou alterado: *"Backup corrompido ou adulterado"*: baixe de novo ou use o de outra hora. **Apague o arquivo em texto claro e a chave solta quando terminar.**

### 3.3 Conferir antes de restaurar de verdade (recomendado)

Num banco local de teste:

```bash
docker compose exec mysql mysql -uroot -p -e "CREATE DATABASE pibls_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c db-20261023-172207.sql.gz | docker compose exec -T mysql mysql -uroot -p pibls_restore
```

Compare as contagens (`users`, `leads_messages`, `ministries_groups`, `site_settings`, `audit_logs`, `bulletins`) com o banco de origem ou com o que se espera. Apague o `pibls_restore` depois.

### 3.4 Restaurar na produção (conta íntegra, só o banco corrompido)

1. **Avise a Secretaria** para não usar o painel e, se der, ponha o site em manutenção. Um contato novo durante a restauração se perde.
2. **Guarde o estado atual:** phpMyAdmin → o banco → **Exportar** (formato SQL, "rápido"). Mesmo corrompido, ele pode ter o que o backup não tem.
3. **Anote as exclusões a pedido do titular (BR-081) feitas depois do backup**, para reaplicá-las no fim, porque o restore traz de volta os dados que a pessoa pediu para apagar:
   ```sql
   SELECT occurred_at, action, resource_type, resource_id FROM audit_logs
   WHERE action IN ('lead.erased', 'registration.erased') AND occurred_at > '<hora do backup, em UTC>';
   ```
4. phpMyAdmin → o banco → **Importar** → o arquivo `.sql.gz` (o phpMyAdmin aceita `.gz`). O dump traz `DROP TABLE IF EXISTS` antes de cada tabela e as estruturas de todas, incluindo `migrations`. Se o phpMyAdmin recusar o tamanho, descompacte e divida, ou peça à HostGator para subir o limite de upload.
5. **Reaplique as exclusões** do passo 3 no painel (*Excluir dados desta pessoa*).
6. Regenere os arquivos públicos, que são derivados do banco: uma tarefa de uso único no cron, `ea-php84 /home/USUARIO/private/bin/artisan.php pibls pibls:snapshots:refresh`, e apague a tarefa.
7. Confira: `GET /api/health`, o início, `/contribua`, `/admin/entrar` (entre de novo: as sessões foram zeradas), o contato mais recente na caixa e a contagem de contatos × o esperado.
8. **Registre o tempo** (item 6) e a causa. Se foi um defeito de release: faça também o rollback (`rollback.md`) e corrija por PR.

### 3.5 Perda total da conta ou do servidor (outra hospedagem, ou uma conta nova)

Ordem, com o responsável e, se preciso, a pessoa do kit de contingência:

1. Conta nova pronta: `setup-hospedagem.md` (domínio, PHP 8.4, pastas, banco, FTPS, cron, segredos).
2. `.env` do kit (**com a mesma `APP_KEY`**: sem ela, os campos cifrados 🔒 não abrem). Banco novo nos dados de `DB_*`.
3. **Banco e release, nesta ordem:** importe o dump **antes** do primeiro deploy (3.4, passo 4) e só então rode o pipeline (GitHub Actions → Deploy). O ativador roda o `migrate`, que não refaz nada (a tabela `migrations` do dump já diz o que foi aplicado) e aplica só as migrations que a release tiver a mais que o dump.
4. **Uploads**: baixe `uploads/` do B2 (chave de leitura) e envie para o `uploads/` do docroot (FTP ou Gerenciador de Arquivos). Nomes são imutáveis e únicos: nada a mesclar.
5. DNS: aponte `pibls.com` para a conta nova **sem mexer em MX, SPF, DKIM** (o e-mail da igreja). Aguarde a propagação; AutoSSL emite o certificado.
6. Atualize os serviços externos (UptimeRobot, Healthchecks) se o endereço mudou, e confira o `BACKUP_PUBLIC_KEY` e `B2_*` no `.env` novo: o primeiro `pibls:backup:db` e a primeira cópia devem rodar sozinhos.
7. Rode o checklist do item 3.4, passo 7. **Registre o tempo total desde o alerta.**

## 4. Ensaio periódico (Constituição VII)

**Uma vez** depois da primeira cópia no B2, **uma vez por ano** (lembrete de fevereiro, `rotina-de-manutencao.md`) e **depois de qualquer mudança** no backup ou na chave (operação enxuta, ADR-021; quem seguir o roteiro completo repete a cada trimestre): peça o backup **mais recente do B2**, com a chave de leitura do kit, e execute 3.1 a 3.3 numa máquina local. Meça cada etapa e **preencha a tabela abaixo**. O ensaio com falha **é o achado mais importante da rotina**: abra uma issue com o erro antes de qualquer outra tarefa.

## 5. Registro dos ensaios

| Data | Tipo | Origem do backup | Baixar (min) | Abrir (min) | Restaurar (min) | Conferência | Total (min) | Resultado e observações |
|---|---|---|---|---|---|---|---|---|
| 2026-10-23 | **Ensaio local do T154** (banco de desenvolvimento) | Dump gerado na hora por `pibls:backup:db`, par de chaves novo | n/a | 0,2 (10 s, com o boot do Laravel sem OPcache) | 0,05 (2 s) | 6 tabelas com contagem **idêntica** (users 8, leads_messages 64, ministries_groups 26, site_settings 10, audit_logs 313, bulletins 8); 23 tabelas nos dois; `sessions` voltou só com a estrutura | ~0,4 (8 s para gerar o backup) | OK. **Não** exercita o B2 nem a chave de leitura: o ensaio completo, a partir do B2, fica para a primeira cópia real em produção |
| | **T154 (completo): a partir do B2** | `db/daily/` | | | | | | |

> **T154 segue aberta** até a linha acima ser preenchida: o critério do PL-03 é restaurar **o banco e os arquivos completos a partir do B2, com a chave privada, num banco local**, e o B2 só existe depois do `setup-hospedagem.md` §3.4. O tempo do ensaio local (segundos) mostra que o gargalo, num incidente real, é **achar a chave e baixar**, não o restore.
