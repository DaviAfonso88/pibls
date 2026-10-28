# Rollback de release

> Origem: `architecture.md` → DevOps → Procedimento de rollback. **Meta: ≤ 10 min** pelo pipeline; ≤ 15 min pelo caminho manual.
> Rollback troca o **código** e o **HTML**. Não desfaz o banco: pelo *expand/contract*, a release anterior continua compatível com o schema novo. Restaurar dados só em caso de corrupção (`restaurar-backup.md`).

## Quando fazer

- A release nova está no ar e algo importante quebrou: página inicial, formulário de contato, painel, PIX.
- O `/api/health` não responde 200 depois de uma ativação.
- Não faça rollback por defeito pequeno: corrija e publique uma release nova (o pipeline leva o mesmo tempo).

## Caminho 1: pelo pipeline (preferido)

1. GitHub → **Actions** → **Rollback** → *Run workflow*.
2. `Ambiente`: `production` (ou `homolog` para ensaio).
3. `release_id`: deixe **vazio** para voltar à release anterior (o ativador a guarda em `status/current.json`), ou informe o id (`2026.11.2`) para ir a uma específica.
4. O revisor do Environment `production` aprova. Não há janela de deploy para rollback.
5. O workflow envia `rollback.json` à caixa de entrada; o ativador (cron de 5 min) recopia o `spa/` da release de destino para o docroot e troca o ponteiro `current.php`. O workflow espera a resposta e confere `GET /api/health` com a release de destino.
6. Depois: confira o site (início, contato, `/admin`), a página **Contribua** e o PIX, e registre o motivo no resumo diário.

## Caminho 2: manual, sem GitHub (cPanel)

Use quando o GitHub ou o FTPS estiverem fora do ar.

1. cPanel → **Gerenciador de Arquivos** → `private/<app>/releases/`: anote o id da release anterior (a pasta mais antiga ainda presente que estava ativa).
2. Edite `private/<app>/current.php` (ícone *Editar*) e troque **só o id**, mantendo o formato:
   ```php
   <?php return 'releases/2026.11.2';
   ```
3. Copie `private/<app>/releases/<id>/spa/*.html` para a raiz do docroot (`public_html/`), sobrescrevendo. **Não** apague `uploads/`, `data/`, `.well-known/` nem `cgi-bin/`. Os arquivos de `assets/` não precisam ser copiados (são cumulativos).
4. Confira `https://pibls.com/api/health`: o campo `release` deve ser o id escolhido.
5. Registre na auditoria quando o sistema voltar (`php artisan pibls:release:activated <id> --rolled-back`, por uma tarefa de uso único no Tarefas Cron com o `artisan.php`).

## Se o rollback falhar

- Status e etapa: `private/<app>/deploy/status/<id>.json`; log do ativador: `private/<app>/shared/storage/logs/finalize-AAAA-MM-DD.log`.
- "A release … não existe mais no servidor": a limpeza semanal (`pibls:releases:cleanup`) mantém só as 5 últimas. Escolha uma que ainda exista em `releases/`.
- Cron parado: o Healthchecks avisa (heartbeat do ativador). Use o caminho manual.

## Ensaios (T023)

Antes do go-live, ensaie **3 deploys e 3 rollbacks em homologação**, cada um em ≤ 10 min, e registre abaixo. Repita a cada trimestre (Go-Live Readiness).

| Data | Operação | Release | Tempo (min) | Problemas / observações |
|---|---|---|---|---|
| | | | | |
