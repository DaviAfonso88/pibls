<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Configuração própria do projeto
|--------------------------------------------------------------------------
|
| Tudo que vem do `.env` do servidor e que não pertence a um pacote. Modelo dos valores: deploy/templates/env.example.
|
*/

return [

    // Versão vigente da Política de Privacidade, gravada em `consent_version` (BR-082)
    'privacy_policy_version' => env('PRIVACY_POLICY_VERSION', '1.0'),

    // Destinatários do alerta de alteração do PIX, separados por vírgula (BR-063). Ficam fora do painel, de propósito.
    'pix_alert_recipients' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('PIX_ALERT_RECIPIENTS', '')),
    ))),

    // Identificador da release em execução (CalVer AAAA.MM.N). O build grava o arquivo `RELEASE` na raiz do backend
    // (o mesmo id do manifest); sem ele (local e CI), vale APP_RELEASE ou "dev".
    'release' => is_file(base_path('RELEASE'))
        ? trim((string) file_get_contents(base_path('RELEASE')))
        : env('APP_RELEASE', 'dev'),

    // Prazos de retenção de dados pessoais (FR-065, Data Privacy Strategy). Mudar um prazo não exige novo código.
    'retention' => [
        'oracao_days' => (int) env('RETENTION_ORACAO_DAYS', 60),
        'oracao_unfinished_days' => (int) env('RETENTION_ORACAO_UNFINISHED_DAYS', 90),
        'leads_months' => (int) env('RETENTION_LEADS_MONTHS', 12),
        'registrations_months' => (int) env('RETENTION_REGISTRATIONS_MONTHS', 3),
        'audit_months' => (int) env('RETENTION_AUDIT_MONTHS', 24),
        'failed_jobs_days' => (int) env('FAILED_JOBS_RETENTION_DAYS', 30),
    ],

    // Backup (ADR-011, I-09). O dump horário é cifrado com a chave PÚBLICA (libsodium, base64); a privada nunca fica no
    // servidor. Sem a chave pública, o dump não é gerado: nada em texto claro.
    'backup' => [
        // Só a produção faz backup e cópia ao B2. A homologação e o ambiente local têm `BACKUPS_ENABLED=false`: os comandos
        // saem sem fazer nada (e sem alarme), em vez de falharem a cada hora por falta de chave.
        'enabled' => filter_var(env('BACKUPS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
        'public_key' => env('BACKUP_PUBLIC_KEY'),
        'path' => env('BACKUPS_PATH', storage_path('backups')),
        // Dumps locais com mais tempo que isto são apagados a cada novo dump
        'local_hours' => 48,
        // Disco S3 do Backblaze B2 (config/filesystems.php)
        'offsite_disk' => env('BACKUP_OFFSITE_DISK', 'b2'),
        // Espera, em segundos, antes de cada nova tentativa do envio ao B2 (1, 5 e 15 min), na mesma execução
        'offsite_backoff' => [60, 300, 900],
    ],

    // Pastas dos logs JSON (`app-AAAA-MM-DD.log`), de onde o resumo diário tira p95, erros e atrasos de e-mail
    'logs_path' => env('PIBLS_LOGS_PATH', storage_path('logs')),

    // Resumo diário por e-mail (I-07, Observability). Vários destinatários separados por vírgula.
    'report' => [
        'recipients' => array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('DAILY_REPORT_RECIPIENTS', '')),
        ))),
        // Data do go-live (AAAA-MM-DD): as semanas do SC-006 contam daí em diante. Vazio = o mês inteiro.
        'go_live_date' => env('GO_LIVE_DATE'),
        // Chave só de leitura do UptimeRobot, para a disponibilidade do mês. Vazio = a linha some do resumo.
        'uptimerobot_api_key' => env('UPTIMEROBOT_API_KEY'),
    ],

    // Mais que isto de e-mails com falha definitiva em 1 h dispara o alerta (`pibls:mail:failure-check`)
    'mail_failure_threshold' => (int) env('MAIL_FAILURE_THRESHOLD', 10),

    // Um check do Healthchecks.io por tarefa (I-08). Vazio = sem ping (local e CI). O do worker é o `healthchecks_ping_url`.
    'healthchecks' => [
        'backup_db' => env('HEALTHCHECKS_BACKUP_DB_URL'),
        'backup_offsite' => env('HEALTHCHECKS_BACKUP_OFFSITE_URL'),
        'retention_purge' => env('HEALTHCHECKS_PURGE_URL'),
        'mail_failures' => env('HEALTHCHECKS_MAIL_URL'),
    ],

    // Homologação: só estes destinatários recebem e-mail de verdade (allowlist, T041). Vazio = sem restrição.
    'mail_allowlist' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('MAIL_ALLOWLIST', '')),
    ))),

    // Healthchecks.io: URL do ping do agendador (heartbeat). Vazio = desligado (local e CI).
    'healthchecks_ping_url' => env('HEALTHCHECKS_PING_URL'),

    // Pasta dos snapshots JSON públicos, servidos pelo Apache direto (ADR-014). Em produção: public_html/data.
    'snapshots_path' => env('SNAPSHOTS_PATH', public_path('data')),

    // HTML de fallback da SPA (`__spa-fallback.html`), em que o Laravel injeta a meta das páginas de detalhe (ADR-004).
    // Em produção fica em public_html; sem o arquivo (local sem build, CI), vale um HTML mínimo.
    'spa_fallback_path' => env('SPA_FALLBACK_PATH', public_path('__spa-fallback.html')),

    // Documentação interativa da API (Scramble, em /docs/api): só em local e homologação. Em produção fica desligada
    // e as rotas nem são registradas.
    'api_docs_enabled' => filter_var(env('API_DOCS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),

    // Consulta à base de senhas vazadas (Have I Been Pwned, I-05; BR-073). Desligar só em ambiente sem internet.
    'hibp_enabled' => filter_var(env('HIBP_ENABLED', true), FILTER_VALIDATE_BOOLEAN),

    // Senha dos usuários do LocalDevelopmentSeeder. Só local e CI; nunca em produção.
    'test_users_password' => env('TEST_USERS_PASSWORD'),

];
