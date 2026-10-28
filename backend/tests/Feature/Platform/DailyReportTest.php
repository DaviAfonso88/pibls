<?php

declare(strict_types=1);

use App\Modules\Content\Models\Bulletin;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Platform\Reports\DailyReport;
use App\Modules\Platform\Reports\DailyReportMail;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/*
|--------------------------------------------------------------------------
| Resumo diário (architecture.md → Observability → Dashboards, Métricas) e alerta de falhas de e-mail
|--------------------------------------------------------------------------
| "Hoje" é 2026-03-10 07:00 em São Paulo (10:00 UTC). O relatório cobre ontem (09/03, de 03:00 UTC de 09/03 até 03:00 UTC
| de 10/03). No dia 1 entra o bloco mensal do mês anterior, sem dado pessoal.
*/

const REPORT_NOW = '2026-03-10 10:00:00';

/** Uma linha do log JSON, como o formatador da aplicação a grava. */
function logLine(string $at, string $message, array $top = [], string $level = 'info', ?array $context = null): string
{
    $line = ['timestamp' => $at, 'level' => $level, 'message' => $message, 'correlationId' => null]
        + array_merge(['userId' => null, 'action' => null, 'resourceType' => null, 'resourceId' => null, 'durationMs' => null, 'httpStatus' => null], $top)
        + ['release' => 'dev', 'env' => 'testing'];
    if ($context !== null) {
        $line['context'] = $context;
    }

    return (string) json_encode($line, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** @param  list<string>  $lines */
function writeLog(string $dir, string $date, array $lines): void
{
    File::ensureDirectoryExists($dir);
    file_put_contents($dir.'/app-'.$date.'.log', implode("\n", $lines)."\n", FILE_APPEND);
}

function httpLine(string $at, string $action, int $ms, int $status = 200): string
{
    return logLine($at, 'http.request', ['action' => $action, 'durationMs' => $ms, 'httpStatus' => $status]);
}

function failedJobAt(Carbon $at): void
{
    DB::table('failed_jobs')->insert([
        'uuid' => (string) Str::uuid(),
        'connection' => 'database',
        'queue' => 'default',
        'payload' => '{}',
        'exception' => 'x',
        'failed_at' => $at,
    ]);
}

function leadOn(string $type, string $status, string $createdAt, ?string $changedAt = null): Lead
{
    $lead = Lead::factory()->state(['type' => $type, 'status' => $status])->create();
    DB::table('leads_messages')->where('id', $lead->getKey())->update([
        'created_at' => $createdAt,
        'status_changed_at' => $changedAt ?? $createdAt,
    ]);

    return $lead;
}

beforeEach(function () {
    Carbon::setTestNow(REPORT_NOW);
    $this->logsDir = sys_get_temp_dir().'/pibls-logs-'.bin2hex(random_bytes(4));
    $this->uploadsDir = sys_get_temp_dir().'/pibls-uploads-'.bin2hex(random_bytes(4));
    $this->backupsDir = sys_get_temp_dir().'/pibls-bk-'.bin2hex(random_bytes(4));
    foreach ([$this->uploadsDir, $this->backupsDir] as $dir) {
        File::ensureDirectoryExists($dir);
    }
    config([
        'pibls.logs_path' => $this->logsDir,
        'pibls.release' => '2026.03.2',
        'pibls.backup.path' => $this->backupsDir,
        'pibls.backup.offsite_disk' => 'b2',
        'filesystems.disks.uploads.root' => $this->uploadsDir,
        'pibls.report.recipients' => ['responsavel@pibls.test'],
        'pibls.report.go_live_date' => null,
        'pibls.report.uptimerobot_api_key' => null,
        'pibls.healthchecks.mail_failures' => 'https://hc-ping.com/mail-check',
        'pibls.mail_failure_threshold' => 10,
    ]);
    Storage::fake('b2');
    Http::fake(['hc-ping.com/*' => Http::response('OK')]);
});

afterEach(function () {
    foreach ([$this->logsDir, $this->uploadsDir, $this->backupsDir] as $dir) {
        File::deleteDirectory($dir);
    }
    Carbon::setTestNow();
});

describe('desempenho e erros (access log do dia anterior)', function () {
    it('calcula p50, p95 e p99 por rota, só com o dia anterior, e compara com as metas', function () {
        $reads = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
        $lines = [];
        foreach ($reads as $i => $ms) {
            $lines[] = httpLine('2026-03-09T12:'.sprintf('%02d', $i).':00.000Z', 'public.settings', $ms);
        }
        foreach ([300, 400] as $i => $ms) {
            $lines[] = httpLine('2026-03-09T15:0'.$i.':00.000Z', 'public.leads.store', $ms, 201);
        }
        // Fora do dia (antes das 03:00 UTC de 09/03 e a partir das 03:00 UTC de 10/03) e de outro tipo de evento
        $lines[] = httpLine('2026-03-09T02:59:59.000Z', 'public.settings', 99_999);
        $lines[] = httpLine('2026-03-10T03:00:00.000Z', 'public.settings', 99_999);
        $lines[] = logLine('2026-03-09T13:00:00.000Z', 'mail.sent', [], 'info', ['type' => 'lead.received', 'delayMs' => 5]);
        writeLog($this->logsDir, '2026-03-09', array_slice($lines, 0, 13));
        writeLog($this->logsDir, '2026-03-10', array_slice($lines, 13));

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        $settings = collect($report['latency'])->firstWhere('route', 'public.settings');
        $store = collect($report['latency'])->firstWhere('route', 'public.leads.store');
        expect($report['date'])->toBe('2026-03-09')
            ->and($settings)->toMatchArray(['requests' => 10, 'p50' => 500, 'p95' => 1000, 'p99' => 1000, 'target' => 800, 'within_target' => false, 'kind' => 'read'])
            ->and($store)->toMatchArray(['requests' => 2, 'p95' => 400, 'target' => 1500, 'within_target' => true, 'kind' => 'write'])
            ->and($report['latency'][0]['route'])->toBe('public.settings'); // a mais lenta primeiro
    });

    it('conta as requisições, os erros 5xx e as linhas de nível error', function () {
        $lines = [];
        foreach (range(1, 8) as $i) {
            $lines[] = httpLine('2026-03-09T12:00:0'.$i.'.000Z', 'public.ministries', 50);
        }
        $lines[] = httpLine('2026-03-09T13:00:00.000Z', 'admin.leads.index', 60, 500);
        $lines[] = httpLine('2026-03-09T13:00:01.000Z', 'admin.leads.index', 70, 503);
        $lines[] = logLine('2026-03-09T13:00:02.000Z', 'Algo quebrou', [], 'error');
        $lines[] = logLine('2026-03-09T13:00:03.000Z', 'Lento', [], 'warning');
        writeLog($this->logsDir, '2026-03-09', $lines);

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['requests'])->toBe(['total' => 10, 'server_errors' => 2, 'error_rate' => 20.0])
            ->and($report['error_logs'])->toBe(1);
    });

    it('funciona sem nenhum arquivo de log (primeiro dia, ou pasta limpa)', function () {
        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['latency'])->toBe([])
            ->and($report['requests'])->toBe(['total' => 0, 'server_errors' => 0, 'error_rate' => 0.0]);
    });
});

describe('fila, backups e disco', function () {
    it('traz a fila (pendentes, falhas das últimas 24 h e total)', function () {
        foreach (range(1, 3) as $i) {
            DB::table('jobs')->insert(['queue' => 'default', 'payload' => '{}', 'attempts' => 0, 'available_at' => now()->timestamp, 'created_at' => now()->timestamp]);
        }
        failedJobAt(now()->subHours(2));
        failedJobAt(now()->subHours(23));
        failedJobAt(now()->subHours(30));

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['queue'])->toBe(['pending' => 3, 'failed_last_24h' => 2, 'failed_total' => 3]);
    });

    it('traz a idade do último backup local e a data da última cópia no B2', function () {
        $local = $this->backupsDir.'/db-20260310-090000.sql.gz.enc';
        file_put_contents($local, 'x');
        touch($local, now()->subHours(2)->getTimestamp());
        Storage::disk('b2')->put('db/daily/2026-03-08.sql.gz.enc', 'a');
        Storage::disk('b2')->put('db/daily/2026-03-09.sql.gz.enc', 'b');

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['backups']['local']['age_hours'])->toBe(2.0)
            ->and($report['backups']['offsite'])->toMatchArray(['latest_date' => '2026-03-09', 'days_behind' => 1, 'error' => null])
            ->and($report['attention'])->toBe([]);
    });

    it('marca como atenção o backup local velho, o B2 atrasado e o B2 inacessível', function () {
        $local = $this->backupsDir.'/db-20260309-000000.sql.gz.enc';
        file_put_contents($local, 'x');
        touch($local, now()->subHours(5)->getTimestamp());
        Storage::disk('b2')->put('db/daily/2026-03-05.sql.gz.enc', 'velho');

        $stale = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));
        expect($stale['attention'])->toContain('Último dump local com mais de 2 h (5 h).')
            ->and($stale['attention'])->toContain('A última cópia no B2 é de 2026-03-05 (5 dias de atraso).');

        $broken = Mockery::mock(Filesystem::class);
        $broken->shouldReceive('files')->andThrow(new RuntimeException('credenciais recusadas'));
        Storage::set('b2', $broken);
        $unreachable = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($unreachable['backups']['offsite']['error'])->toBe('credenciais recusadas')
            ->and($unreachable['attention'])->toContain('Não foi possível consultar o B2: credenciais recusadas');
    });

    it('sem nenhum backup local, avisa em vez de calcular idade', function () {
        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['backups']['local'])->toBe(['age_hours' => null])
            ->and($report['attention'])->toContain('Nenhum dump local encontrado.');
    });

    it('soma o disco de uploads e de backups e conta os arquivos (inodes)', function () {
        file_put_contents($this->uploadsDir.'/a.pdf', str_repeat('a', 100));
        File::ensureDirectoryExists($this->uploadsDir.'/boletins');
        file_put_contents($this->uploadsDir.'/boletins/b.pdf', str_repeat('b', 50));
        file_put_contents($this->backupsDir.'/db-1.sql.gz.enc', str_repeat('c', 1000));

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['disk'])->toBe(['uploads_bytes' => 150, 'backups_bytes' => 1000, 'files' => 3]);
    });
});

describe('contatos e inscrições', function () {
    it('lista os contatos NOVO parados há mais de 3 dias, por tipo', function () {
        leadOn('VISITANTE', 'NOVO', now()->subDays(4)->toDateTimeString());
        leadOn('VISITANTE', 'NOVO', now()->subDays(10)->toDateTimeString());
        leadOn('CONTATO', 'NOVO', now()->subDays(3)->subHour()->toDateTimeString());
        leadOn('CONTATO', 'NOVO', now()->subDays(2)->toDateTimeString());
        leadOn('MEMBRO', 'EM_ATENDIMENTO', now()->subDays(20)->toDateTimeString());
        leadOn('ORACAO', 'CONCLUIDO', now()->subDays(20)->toDateTimeString());

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['stale_leads'])->toBe(['total' => 3, 'by_type' => ['VISITANTE' => 2, 'CONTATO' => 1]])
            ->and($report['attention'])->toContain('3 contatos novos esperando há mais de 3 dias.');
    });

    it('conta as inscrições do dia anterior', function () {
        $event = Event::factory()->create();
        foreach (['2026-03-09 12:00:00', '2026-03-09 20:00:00', '2026-03-10 05:00:00', '2026-03-08 12:00:00'] as $at) {
            $registration = EventRegistration::factory()->create(['event_id' => $event->getKey()]);
            DB::table('event_registrations')->where('id', $registration->getKey())->update(['created_at' => $at]);
        }

        $report = app(DailyReport::class)->build(CarbonImmutable::parse(REPORT_NOW));

        expect($report['registrations_yesterday'])->toBe(2);
    });
});

describe('bloco mensal (só no dia 1, sem dado pessoal)', function () {
    beforeEach(function () {
        Carbon::setTestNow('2026-04-01 10:00:00'); // 07:00 de 1º de abril em São Paulo; o mês é março
    });

    it('não existe fora do dia 1', function () {
        Carbon::setTestNow('2026-04-02 10:00:00');

        expect(app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'])->toBeNull();
    });

    it('conta os contatos recebidos e concluídos por tipo no mês anterior', function () {
        leadOn('VISITANTE', 'CONCLUIDO', '2026-03-05 10:00:00', '2026-03-08 10:00:00');
        leadOn('VISITANTE', 'CONCLUIDO', '2026-03-06 10:00:00', '2026-03-20 10:00:00');
        leadOn('MEMBRO', 'NOVO', '2026-03-10 10:00:00');
        leadOn('CONTATO', 'CONCLUIDO', '2026-03-12 10:00:00', '2026-03-13 10:00:00');
        leadOn('ORACAO', 'NOVO', '2026-03-12 11:00:00');
        leadOn('VISITANTE', 'CONCLUIDO', '2026-02-27 10:00:00', '2026-02-28 10:00:00'); // fevereiro
        leadOn('VISITANTE', 'NOVO', '2026-04-01 05:00:00'); // abril (02:00 em São Paulo, já é 1º de abril lá também)

        $monthly = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];

        expect($monthly['month'])->toBe('2026-03')
            ->and($monthly['leads'])->toBe([
                'VISITANTE' => ['received' => 2, 'concluded' => 2],
                'MEMBRO' => ['received' => 1, 'concluded' => 0],
                'ORACAO' => ['received' => 1, 'concluded' => 0],
                'CONTATO' => ['received' => 1, 'concluded' => 1],
                'MINISTERIO' => ['received' => 0, 'concluded' => 0],
            ]);
    });

    it('SC-003 calcula a taxa de visitantes e membros concluídos em até 7 dias', function () {
        leadOn('VISITANTE', 'CONCLUIDO', '2026-03-05 10:00:00', '2026-03-08 10:00:00'); // 3 dias: conta
        leadOn('VISITANTE', 'CONCLUIDO', '2026-03-06 10:00:00', '2026-03-20 10:00:00'); // 14 dias: não conta
        leadOn('MEMBRO', 'NOVO', '2026-03-10 10:00:00'); // aberto: não conta
        leadOn('CONTATO', 'CONCLUIDO', '2026-03-12 10:00:00', '2026-03-12 11:00:00'); // outro tipo: fora da métrica

        $monthly = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];

        expect($monthly['concluded_in_7_days_rate'])->toBe(33.3);
    });

    it('SC-003 vem nula quando não houve visitante nem membro no mês', function () {
        $monthly = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];

        expect($monthly['concluded_in_7_days_rate'])->toBeNull();
    });

    it('SC-004 calcula a mediana do tempo até a primeira mudança de status, em horas', function () {
        $changes = ['2026-03-05 10:00:00' => 5, '2026-03-06 10:00:00' => 30, '2026-03-12 10:00:00' => 1];
        foreach ($changes as $createdAt => $hours) {
            $lead = leadOn('VISITANTE', 'EM_ATENDIMENTO', $createdAt);
            $first = CarbonImmutable::parse($createdAt)->addHours($hours);
            // Uma anotação sem troca de status vem antes e não conta; a segunda troca também não
            LeadActivity::factory()->create(['lead_id' => $lead->getKey(), 'to_status' => null, 'note' => 'ligou']);
            DB::table('lead_activities')->where('lead_id', $lead->getKey())->update(['created_at' => CarbonImmutable::parse($createdAt)->addMinutes(5)]);
            LeadActivity::factory()->create(['lead_id' => $lead->getKey(), 'from_status' => 'NOVO', 'to_status' => 'EM_ATENDIMENTO', 'note' => null]);
            LeadActivity::factory()->create(['lead_id' => $lead->getKey(), 'from_status' => 'EM_ATENDIMENTO', 'to_status' => 'CONCLUIDO', 'note' => null]);
            DB::table('lead_activities')->where('lead_id', $lead->getKey())->whereNotNull('to_status')->orderBy('id')->limit(1)->update(['created_at' => $first]);
            DB::table('lead_activities')->where('lead_id', $lead->getKey())->where('to_status', 'CONCLUIDO')->update(['created_at' => $first->addDays(3)]);
        }
        leadOn('CONTATO', 'NOVO', '2026-03-15 10:00:00'); // sem nenhuma mudança: fora da mediana

        $monthly = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];

        expect($monthly['median_first_change_hours'])->toBe(5.0);
    });

    it('SC-006 conta as semanas com boletim publicado até domingo às 8h, a partir do go-live', function () {
        config(['pibls.report.go_live_date' => '2026-03-08']);
        $bulletin = fn (string $sunday, string $publishedAtUtc) => Bulletin::factory()->create([
            'reference_date' => $sunday,
            'published_at' => $publishedAtUtc,
        ]);
        $bulletin('2026-03-08', '2026-03-07 12:00:00'); // sábado: no prazo
        $bulletin('2026-03-15', '2026-03-15 10:59:00'); // 07:59 em São Paulo: no prazo
        $bulletin('2026-03-22', '2026-03-22 11:01:00'); // 08:01: atrasado
        $bulletin('2026-03-29', '2026-03-28 12:00:00')->delete(); // excluído: não conta
        $bulletin('2026-03-01', '2026-02-28 12:00:00'); // antes do go-live: fora das semanas

        $monthly = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];

        expect($monthly['bulletins'])->toBe(['on_time' => 2, 'weeks' => 4]);
    });

    it('SC-019 calcula o p95 do atraso dos avisos por e-mail a partir do log mail.sent', function () {
        $lines = [];
        foreach (range(1, 20) as $i) {
            $lines[] = logLine('2026-03-'.sprintf('%02d', $i).'T12:00:00.000Z', 'mail.sent', [], 'info', ['type' => 'lead.received', 'delayMs' => $i * 1000]);
        }
        $lines[] = logLine('2026-04-01T12:00:00.000Z', 'mail.sent', [], 'info', ['type' => 'lead.received', 'delayMs' => 999_000]); // abril
        foreach (range(1, 20) as $i) {
            writeLog($this->logsDir, '2026-03-'.sprintf('%02d', $i), [$lines[$i - 1]]);
        }
        writeLog($this->logsDir, '2026-04-01', [$lines[20]]);

        $monthly = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];

        expect($monthly['mail_delay_p95_seconds'])->toBe(19.0);
    });

    it('a disponibilidade do mês vem do UptimeRobot e fica nula sem a chave ou com a API fora', function () {
        $without = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];
        expect($without['availability_percent'])->toBeNull();

        config(['pibls.report.uptimerobot_api_key' => 'ur-key']);
        $response = Http::response([
            'stat' => 'ok',
            'monitors' => [['custom_uptime_ranges' => '99.90'], ['custom_uptime_ranges' => '100.00']],
        ]);
        // O primeiro `Http::fake` que casa vence; por isso a resposta é trocada por fora
        Http::fake(['api.uptimerobot.com/*' => function () use (&$response) {
            return $response;
        }]);

        $with = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];
        expect($with['availability_percent'])->toBe(99.95);

        $response = Http::response('', 500);
        $down = app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString()))['monthly'];
        expect($down['availability_percent'])->toBeNull();
    });

    it('não leva nome, telefone nem e-mail de ninguém', function () {
        leadOn('VISITANTE', 'CONCLUIDO', '2026-03-05 10:00:00', '2026-03-06 10:00:00');
        $lead = Lead::query()->latest('id')->firstOrFail();

        $json = json_encode(app(DailyReport::class)->build(CarbonImmutable::parse(now()->toDateTimeString())), JSON_UNESCAPED_UNICODE);

        expect($json)->not->toContain((string) $lead->name)->not->toContain((string) $lead->phone)->not->toContain((string) $lead->email);
    });
});

describe('pibls:daily-report', function () {
    it('enfileira o resumo para os destinatários configurados, com as seções e a release', function () {
        Mail::fake();
        writeLog($this->logsDir, '2026-03-09', [httpLine('2026-03-09T12:00:00.000Z', 'public.settings', 1200)]);

        $exit = Artisan::call('pibls:daily-report');

        expect($exit)->toBe(0);
        Mail::assertQueued(DailyReportMail::class, function (DailyReportMail $mail) {
            $html = $mail->render();

            return $mail->hasTo('responsavel@pibls.test')
                && str_contains($mail->envelope()->subject, 'Resumo diário')
                && str_contains($mail->envelope()->subject, '09/03/2026')
                && str_contains($html, '2026.03.2')
                && str_contains($html, 'public.settings')
                && str_contains($html, '1200 ms')
                && str_contains($html, 'Fila')
                && str_contains($html, 'Backups')
                && str_contains($html, 'Disco')
                && str_contains($html, 'Contatos')
                && str_contains($html, 'Inscrições')
                && ! str_contains($html, 'Resumo mensal');
        });
    });

    it('no dia 1 traz o resumo mensal no mesmo e-mail', function () {
        Mail::fake();
        Carbon::setTestNow('2026-04-01 10:00:00');

        Artisan::call('pibls:daily-report');

        Mail::assertQueued(DailyReportMail::class, fn (DailyReportMail $mail) => str_contains($mail->render(), 'Resumo mensal')
            && str_contains($mail->render(), 'março de 2026'));
    });

    it('sem destinatários configurados avisa e não enfileira nada', function () {
        Mail::fake();
        config(['pibls.report.recipients' => []]);

        $exit = Artisan::call('pibls:daily-report');

        expect($exit)->toBe(0)->and(Artisan::output())->toContain('DAILY_REPORT_RECIPIENTS');
        Mail::assertNothingQueued();
    });

    it('o e-mail em texto puro não leva HTML', function () {
        Mail::fake();

        Artisan::call('pibls:daily-report');

        Mail::assertQueued(DailyReportMail::class, function (DailyReportMail $mail) {
            $text = view('mail.daily-report.text', $mail->content()->with)->render();

            return str_contains($text, 'Resumo diário') && ! str_contains($text, '<table');
        });
    });
});

describe('pibls:mail:failure-check', function () {
    it('pinga /fail quando há mais de 10 falhas definitivas na última hora', function () {
        foreach (range(1, 11) as $i) {
            failedJobAt(now()->subMinutes($i));
        }

        $exit = Artisan::call('pibls:mail:failure-check');

        expect($exit)->toBe(0);
        Http::assertSent(fn ($request) => $request->url() === 'https://hc-ping.com/mail-check/fail');
    });

    it('com 10 falhas ou menos, ou só falhas antigas, pinga o sucesso', function () {
        foreach (range(1, 10) as $i) {
            failedJobAt(now()->subMinutes($i));
        }
        foreach (range(1, 20) as $i) {
            failedJobAt(now()->subHours(2));
        }

        Artisan::call('pibls:mail:failure-check');

        Http::assertSent(fn ($request) => $request->url() === 'https://hc-ping.com/mail-check');
        Http::assertNotSent(fn ($request) => str_ends_with($request->url(), '/fail'));
    });

    it('o limite vem da configuração', function () {
        config(['pibls.mail_failure_threshold' => 2]);
        foreach (range(1, 3) as $i) {
            failedJobAt(now()->subMinutes($i));
        }

        Artisan::call('pibls:mail:failure-check');

        Http::assertSent(fn ($request) => $request->url() === 'https://hc-ping.com/mail-check/fail');
    });

    it('sem URL do Healthchecks não pinga nada e não quebra', function () {
        config(['pibls.healthchecks.mail_failures' => null]);
        foreach (range(1, 11) as $i) {
            failedJobAt(now()->subMinutes($i));
        }

        expect(Artisan::call('pibls:mail:failure-check'))->toBe(0);
        Http::assertNothingSent();
    });
});
