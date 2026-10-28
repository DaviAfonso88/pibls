# Operação enxuta: o que fazer na implantação (T152, T154 e T155)

> Decisão: ADR-021. É o mínimo que protege os dados e avisa quando o site cai. Leva cerca de **1 hora**. O roteiro completo (todos os serviços, todos os testes) continua em `setup-hospedagem.md` §3 para quem quiser religá-lo depois; nada do código foi removido.
> **Pré-requisito:** a conta da HostGator pronta e o `.env` de produção criado (`setup-hospedagem.md` §2).

## Parte 1: backup fora da hospedagem (a única parte obrigatória)

**1. Gerar as chaves, na sua máquina** (não no servidor):

```
docker compose exec app php artisan pibls:backup:keygen
```

Saem duas linhas. Guarde as duas agora num arquivo temporário seguro; no fim da Parte 4 elas vão para o cofre.

- `BACKUP_PUBLIC_KEY=…` vai para o servidor (passo 3).
- `BACKUP_PRIVATE_KEY=…` **nunca sai da sua máquina e do cofre.** Sem ela, nenhum backup abre. Faça uma cópia dela logo.

**2. Criar o bucket no Backblaze B2** (crie a conta com 2FA):

1. Buckets → **Create a Bucket**: nome livre, **Private**, região **EU (Amsterdam)**.
2. **Lifecycle Settings** do bucket, três regras: `db/daily/` apagar após **35** dias; `db/monthly/` após **365**; `uploads/` sem regra.
3. App Keys → **Add a New Application Key**: restrita a esse bucket, permissões **Read and Write**, e **sem** a permissão de excluir arquivos. Copie o `keyID` e a `applicationKey` (aparecem uma vez só).
4. Anote também o *endpoint* S3 do bucket (`s3.eu-central-003.backblazeb2.com` ou o que a tela mostrar) e a região.

**3. Colar no `.env` de produção** (cPanel → Gerenciador de Arquivos → `private/pibls/shared/.env`):

```
BACKUPS_ENABLED=true
BACKUP_PUBLIC_KEY=<a linha pública do passo 1>
B2_KEY_ID=<keyID>
B2_APPLICATION_KEY=<applicationKey>
B2_BUCKET=<nome do bucket>
B2_REGION=eu-central-003
B2_ENDPOINT=https://s3.eu-central-003.backblazeb2.com
```

Na **homologação**: `BACKUPS_ENABLED=false`. O resto fica como está.

## Parte 2: dois avisos (cada um leva 5 minutos)

**4. Healthchecks.io** (healthchecks.io, plano gratuito): crie **2 checks**, ambos com aviso por e-mail para você e, de preferência, push no celular.

| Check | Período e tolerância | Variável do `.env` |
|---|---|---|
| Worker de e-mail | 5 min, tolerância 15 min | `HEALTHCHECKS_PING_URL=https://hc-ping.com/<uuid>` |
| Cópia externa (B2) | 1 dia, tolerância 2 h | `HEALTHCHECKS_BACKUP_OFFSITE_URL=https://hc-ping.com/<uuid>` |

**5. UptimeRobot** (uptimerobot.com, plano gratuito): **1 monitor** do tipo HTTP(s) para `https://pibls.com/`, intervalo de 5 minutos, alerta por e-mail (e push) para você e por e-mail para uma pessoa da liderança.

## Parte 3: testar uma vez (T152 e T154)

**6. Provar que o backup chega ao B2.** No cPanel → **Tarefas Cron**, crie uma tarefa de uso único (daqui a 5 min) com:

```
ea-php84 /home/USUARIO/private/bin/artisan.php pibls pibls:backup:db
```

e outra, 10 minutos depois, com `… pibls pibls:backup:offsite`. Confira:

- aparece um arquivo `db-….sql.gz.enc` em `private/pibls/shared/storage/backups/`;
- no painel do B2, existe `db/daily/AAAA-MM-DD.sql.gz.enc` (e uma pasta `uploads/`);
- o check "Cópia externa" ficou **verde** no Healthchecks.

Apague as duas tarefas depois.

**7. Provar que a restauração funciona (T154)**, na sua máquina, uma única vez:

1. Baixe o `db/daily/…enc` mais recente pelo painel do B2.
2. Abra e restaure num banco de teste:

```
docker compose exec app php artisan pibls:backup:decrypt <arquivo.enc> --key-file=<chave-privada.txt>
docker compose exec mysql mysql -uroot -p -e "CREATE DATABASE pibls_restore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c <arquivo.sql.gz> | docker compose exec -T mysql mysql -uroot -p pibls_restore
```

3. Compare as contagens de `users`, `leads_messages`, `ministries_groups`, `site_settings`, `audit_logs` e `bulletins` com o banco de produção (phpMyAdmin). Se baterem, está provado.
4. Anote a data e o tempo na tabela do §5 de `restaurar-backup.md` e apague o `pibls_restore`, o `.sql.gz` e a chave solta.

## Parte 4: o kit de contingência (T155)

**8. Um cofre simples** (KeePassXC, gratuito):

1. Crie o arquivo `.kdbx` com uma senha mestra forte.
2. Cadastre **6 entradas**: **cPanel/HostGator**, **domínio**, **`.env` de produção** (cole o arquivo inteiro; a `APP_KEY` é crítica), **chave privada dos backups**, **GitHub** (login e códigos de recuperação do 2FA) e **Backblaze B2** (login).
3. Entregue uma cópia do arquivo a **uma pessoa de confiança da liderança**, e a senha mestra a ela **separadamente** (por exemplo, escrita em papel, guardada por ela). Guarde outra cópia com você, em outro lugar.
4. Peça que ela **abra o cofre uma vez** na sua frente, para saber que funciona.
5. Preencha a tabela do §5 de `kit-de-contingencia.md` (data, quem recebeu, onde guarda).

Quando alguém trocar uma senha ou chave (por exemplo, na janela anual), atualize **as duas** cópias no mesmo dia.

## O que ficou desligado de propósito

| O quê | Por que não precisa agora | Como religar |
|---|---|---|
| Sentry | O log em arquivo registra os erros | `SENTRY_LARAVEL_DSN` no `.env` |
| Resumo diário por e-mail | Mais um e-mail por dia | `DAILY_REPORT_RECIPIENTS` no `.env` |
| Os outros 3 checks do Healthchecks (`BACKUP_DB`, `PURGE`, `MAIL`) | O dump horário local é conferido pela cópia do dia seguinte | Preencher as variáveis `HEALTHCHECKS_*` vazias |
| Monitores do UptimeRobot de `/api/health` e do certificado | A página inicial já cai junto; o AutoSSL renova sozinho | Criar os monitores |
| Teste de restauração e de rollback a cada trimestre | Passa a ser **uma vez por ano** (fevereiro) e depois de mudança no backup ou na chave | Os lembretes automáticos já avisam |

## Se der errado

- **O check da cópia externa ficou vermelho:** veja `private/pibls/shared/storage/logs/app-AAAA-MM-DD.log` (procure `backup.offsite_failed`). Causas comuns: chave do B2 errada, nome do bucket errado ou *endpoint* de outra região.
- **`BACKUP_PUBLIC_KEY não está configurada`:** o `.env` está sem a chave, ou está na homologação (`BACKUPS_ENABLED=false`).
- **`A chave privada não abre este backup`:** a pública do servidor não é a par dessa privada. Gere um par novo e troque a pública do `.env`; os backups feitos com a anterior só abrem com a privada anterior.
- **Qualquer outra coisa:** me mande a mensagem de erro.
