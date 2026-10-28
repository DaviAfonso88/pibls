<?php

declare(strict_types=1);

use App\Modules\Platform\Console\Heartbeat;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
|--------------------------------------------------------------------------
| Agendador (architecture.md → Infrastructure → Cron)
|--------------------------------------------------------------------------
|
| A hospedagem só tem o cron do cPanel: `artisan.php <app> schedule:run` a cada 5 min. Não há processo residente,
| então o worker de e-mail é um `queue:work` curto, que esvazia a fila e sai.
|
*/

// Conteúdo agendado que passou a valer entra nos snapshots (BR-042). Sem nada novo, não grava nada.
Schedule::command('pibls:snapshots:refresh-scheduled')
    ->name('snapshots-refresh-scheduled')
    ->everyFiveMinutes()
    ->withoutOverlapping(10);

// Worker de e-mail (ADR-003): no máximo 20 e-mails ou 4 min por execução; sem sobreposição; heartbeat no Healthchecks.
Heartbeat::attach(
    Schedule::command('queue:work --stop-when-empty --max-time=240 --max-jobs=20')
        ->name('queue-work')
        ->everyFiveMinutes()
        ->withoutOverlapping(10),
    config('pibls.healthchecks_ping_url'),
);

/*
|--------------------------------------------------------------------------
| Rotinas de operação (architecture.md → Infrastructure → Tarefas do agendador)
|--------------------------------------------------------------------------
|
| Horários em America/Sao_Paulo. Cada tarefa que alerta tem o seu check no Healthchecks (o ping sai do próprio comando,
| com timeout de 5 s e uma nova tentativa; ver `Healthchecks`). `withoutOverlapping` leva o tempo da trava em minutos: a
| cópia externa tem folga para as três novas tentativas de 1, 5 e 15 min.
|
*/

// Dump cifrado do banco, de hora em hora (RPO ≤ 1 h). Mantém só os de 48 h.
Schedule::command('pibls:backup:db')
    ->name('backup-db')
    ->hourly()
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);

// Cópia fora da hospedagem: o dump do dia (e o mensal, no dia 1) e os uploads novos.
Schedule::command('pibls:backup:offsite')
    ->name('backup-offsite')
    ->dailyAt('03:30')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(90);

// Expurgo LGPD (BR-080): contatos, inscrições e falhas de fila vencidos.
Schedule::command('pibls:retention:purge')
    ->name('retention-purge')
    ->dailyAt('04:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);

Schedule::command('queue:prune-failed --hours=720')
    ->name('queue-prune-failed')
    ->dailyAt('04:15')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(10);

// Auditoria com mais de 24 meses, no dia 1 de cada mês.
Schedule::command('pibls:audit:prune')
    ->name('audit-prune')
    ->monthlyOn(1, '04:30')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);

// Resumo diário por e-mail (no dia 1 leva o mensal). Entra na fila; o worker o entrega.
Schedule::command('pibls:daily-report')
    ->name('daily-report')
    ->dailyAt('07:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);

// Onda de e-mails com falha definitiva (mais de 10 em 1 h) vira ping /fail no Healthchecks.
Schedule::command('pibls:mail:failure-check')
    ->name('mail-failure-check')
    ->everyFifteenMinutes()
    ->withoutOverlapping(10);

// Mantém as 5 últimas releases e os assets delas (nunca a ativa nem a anterior), aos domingos de manhã.
Schedule::command('pibls:releases:cleanup')
    ->name('releases-cleanup')
    ->weeklyOn(0, '05:00')
    ->timezone('America/Sao_Paulo')
    ->withoutOverlapping(30);
