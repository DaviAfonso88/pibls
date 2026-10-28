<?php

declare(strict_types=1);

use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Carbon;

/*
|--------------------------------------------------------------------------
| Agendador (architecture.md → Infrastructure → Tarefas do agendador)
|--------------------------------------------------------------------------
| O cron da hospedagem chama `schedule:run` a cada 5 min; cada tarefa decide sozinha se está na hora. Os horários são em
| America/Sao_Paulo (UTC-3, sem horário de verão desde 2019), e nenhuma tarefa pode rodar em duas instâncias ao mesmo tempo.
*/

afterEach(fn () => Carbon::setTestNow());

function scheduledEvent(string $name): Event
{
    $event = collect(app(Schedule::class)->events())->first(fn (Event $event) => $event->description === $name);
    expect($event)->not->toBeNull("a tarefa {$name} não está agendada");

    return $event;
}

it('agenda o dump do banco de hora em hora, no minuto 0', function () {
    $event = scheduledEvent('backup-db');

    expect($event->command)->toContain('pibls:backup:db')
        ->and($event->expression)->toBe('0 * * * *')
        ->and($event->withoutOverlapping)->toBeTrue();
});

it('agenda a cópia externa às 03:30 de São Paulo, 06:30 UTC', function () {
    $event = scheduledEvent('backup-offsite');

    expect($event->command)->toContain('pibls:backup:offsite')
        ->and($event->expression)->toBe('30 3 * * *')
        ->and($event->timezone)->toBe('America/Sao_Paulo')
        ->and($event->withoutOverlapping)->toBeTrue();

    Carbon::setTestNow('2026-03-10 06:30:00');
    expect($event->isDue(app()))->toBeTrue();

    Carbon::setTestNow('2026-03-10 03:30:00'); // 00:30 em São Paulo
    expect($event->isDue(app()))->toBeFalse();
});

it('agenda o expurgo às 04:00 e a limpeza das falhas de fila às 04:15, de São Paulo', function () {
    $purge = scheduledEvent('retention-purge');
    $prune = scheduledEvent('queue-prune-failed');

    expect($purge->command)->toContain('pibls:retention:purge')
        ->and($purge->expression)->toBe('0 4 * * *')
        ->and($purge->timezone)->toBe('America/Sao_Paulo')
        ->and($prune->command)->toContain('queue:prune-failed --hours=720')
        ->and($prune->expression)->toBe('15 4 * * *')
        ->and($prune->timezone)->toBe('America/Sao_Paulo');
});

it('agenda o expurgo da auditoria no dia 1 de cada mês', function () {
    $event = scheduledEvent('audit-prune');

    expect($event->command)->toContain('pibls:audit:prune')
        ->and($event->expression)->toBe('30 4 1 * *')
        ->and($event->timezone)->toBe('America/Sao_Paulo');

    Carbon::setTestNow('2026-04-01 07:30:00'); // 04:30 do dia 1 em São Paulo
    expect($event->isDue(app()))->toBeTrue();

    Carbon::setTestNow('2026-04-02 07:30:00');
    expect($event->isDue(app()))->toBeFalse();
});

it('agenda o resumo diário às 07:00 de São Paulo, 10:00 UTC', function () {
    $event = scheduledEvent('daily-report');

    expect($event->command)->toContain('pibls:daily-report')
        ->and($event->expression)->toBe('0 7 * * *')
        ->and($event->timezone)->toBe('America/Sao_Paulo');

    Carbon::setTestNow('2026-03-10 10:00:00');
    expect($event->isDue(app()))->toBeTrue();
});

it('limpa as releases antigas uma vez por semana, aos domingos de manhã', function () {
    $event = scheduledEvent('releases-cleanup');

    expect($event->command)->toContain('pibls:releases:cleanup')
        ->and($event->expression)->toBe('0 5 * * 0')
        ->and($event->timezone)->toBe('America/Sao_Paulo');

    Carbon::setTestNow('2026-03-15 08:00:00'); // domingo, 05:00 em São Paulo
    expect($event->isDue(app()))->toBeTrue();

    Carbon::setTestNow('2026-03-16 08:00:00'); // segunda
    expect($event->isDue(app()))->toBeFalse();
});

it('confere a onda de falhas de e-mail a cada 15 minutos', function () {
    $event = scheduledEvent('mail-failure-check');

    expect($event->command)->toContain('pibls:mail:failure-check')
        ->and($event->expression)->toBe('*/15 * * * *')
        ->and($event->withoutOverlapping)->toBeTrue();
});

it('mantém o worker de e-mail e a atualização de snapshots a cada 5 minutos', function () {
    expect(scheduledEvent('queue-work')->expression)->toBe('*/5 * * * *')
        ->and(scheduledEvent('queue-work')->command)->toContain('queue:work --stop-when-empty --max-time=240 --max-jobs=20')
        ->and(scheduledEvent('snapshots-refresh-scheduled')->expression)->toBe('*/5 * * * *');
});

it('toda tarefa do agendador roda sem sobreposição', function () {
    $events = app(Schedule::class)->events();

    expect($events)->not->toBeEmpty();
    foreach ($events as $event) {
        expect($event->withoutOverlapping)->toBeTrue("{$event->description} pode rodar em duas instâncias");
    }
});

it('todo comando agendado existe no Artisan', function () {
    $registered = array_keys(Artisan::all());

    foreach (app(Schedule::class)->events() as $event) {
        preg_match('/artisan[\'"]?\s+([\w:\-]+)/', (string) $event->command, $match);
        expect(in_array($match[1], $registered, true))->toBeTrue("{$event->description} agenda um comando que não existe");
    }
});
