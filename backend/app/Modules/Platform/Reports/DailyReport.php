<?php

declare(strict_types=1);

namespace App\Modules\Platform\Reports;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use Throwable;

/**
 * Monta os números do resumo diário (architecture.md → Observability → Métricas e Dashboards). O dia do relatório é o dia
 * ANTERIOR em São Paulo; no dia 1 entra também o bloco mensal do mês anterior, sem dado pessoal (só contagens e medianas).
 *
 * `Platform` não conhece os módulos de negócio: contatos, inscrições e boletins são lidos pelas tabelas. Tudo o que sai
 * daqui é escalar ou lista de escalares, pronto para virar JSON e para as views do e-mail.
 */
class DailyReport
{
    private const TIMEZONE = 'America/Sao_Paulo';

    /** Os tipos de contato, na ordem em que aparecem nos relatórios. */
    private const LEAD_TYPES = ['VISITANTE', 'MEMBRO', 'ORACAO', 'CONTATO', 'MINISTERIO'];

    /** Metas de p95 em ms (Performance): leitura pública e escrita. */
    private const TARGET_READ_MS = 800;

    private const TARGET_WRITE_MS = 1500;

    /** O dump é de hora em hora: passar disto é sinal de cron parado. */
    private const LOCAL_BACKUP_MAX_HOURS = 2;

    /** A cópia no B2 é diária, às 03:30: às 07:00 a de hoje já deve existir; um dia de atraso é tolerado. */
    private const OFFSITE_MAX_DAYS_BEHIND = 1;

    private const STALE_LEAD_DAYS = 3;

    private const MAX_ROUTES = 15;

    public function __construct(private readonly UptimeRobot $uptime) {}

    /**
     * @return array<string, mixed>
     */
    public function build(CarbonImmutable $now): array
    {
        $local = $now->setTimezone(self::TIMEZONE);
        $day = $local->subDay()->startOfDay();
        $from = $day->utc();
        $to = $day->addDay()->utc();
        $logs = LogReader::fromConfig();

        [$latency, $requests, $errorLogs] = $this->access($logs, $from, $to);
        $queue = $this->queue($now);
        $backups = $this->backups($now, $local);
        $stale = $this->staleLeads($now);

        $report = [
            'date' => $day->format('Y-m-d'),
            'date_label' => $day->format('d/m/Y'),
            'release' => (string) config('pibls.release'),
            'latency' => $latency,
            'requests' => $requests,
            'error_logs' => $errorLogs,
            'queue' => $queue,
            'backups' => $backups,
            'disk' => $this->disk(),
            'stale_leads' => $stale,
            'registrations_yesterday' => DB::table('event_registrations')->where('created_at', '>=', $from)->where('created_at', '<', $to)->count(),
            'monthly' => $local->day === 1 ? $this->monthly($local, $logs) : null,
        ];
        $report['attention'] = $this->attention($report);

        return $report;
    }

    /**
     * @return array{0: list<array<string, mixed>>, 1: array{total: int, server_errors: int, error_rate: float}, 2: int}
     */
    private function access(LogReader $logs, CarbonImmutable $from, CarbonImmutable $to): array
    {
        /** @var array<string, list<int>> $byRoute */
        $byRoute = [];
        $total = 0;
        $serverErrors = 0;
        $errorLogs = 0;

        foreach ($logs->lines($from, $to) as $line) {
            if (($line['level'] ?? null) === 'error') {
                $errorLogs++;
            }
            if (($line['message'] ?? null) !== 'http.request') {
                continue;
            }
            $total++;
            if ((int) ($line['httpStatus'] ?? 0) >= 500) {
                $serverErrors++;
            }
            if (is_string($line['action'] ?? null) && is_int($line['durationMs'] ?? null)) {
                $byRoute[$line['action']][] = $line['durationMs'];
            }
        }

        $rows = [];
        foreach ($byRoute as $route => $durations) {
            $write = self::isWrite($route);
            $target = $write ? self::TARGET_WRITE_MS : self::TARGET_READ_MS;
            $p95 = (int) LogReader::percentile($durations, 95);
            $rows[] = [
                'route' => $route,
                'kind' => $write ? 'write' : 'read',
                'requests' => count($durations),
                'p50' => (int) LogReader::percentile($durations, 50),
                'p95' => $p95,
                'p99' => (int) LogReader::percentile($durations, 99),
                'target' => $target,
                'within_target' => $p95 <= $target,
            ];
        }
        usort($rows, static fn (array $a, array $b): int => $b['p95'] <=> $a['p95']);

        return [
            array_slice($rows, 0, self::MAX_ROUTES),
            ['total' => $total, 'server_errors' => $serverErrors, 'error_rate' => $total === 0 ? 0.0 : round(100 * $serverErrors / $total, 2)],
            $errorLogs,
        ];
    }

    /** O access log guarda o nome da rota, não o método: escrita é o que termina em store/update/destroy ou é de autenticação. */
    private static function isWrite(string $action): bool
    {
        return preg_match('/^(POST|PUT|PATCH|DELETE) /', $action) === 1
            || preg_match('/\.(store|update|destroy|login|logout|forgot-password|reset-password)$/', $action) === 1;
    }

    /**
     * @return array{pending: int, failed_last_24h: int, failed_total: int}
     */
    private function queue(CarbonImmutable $now): array
    {
        return [
            'pending' => DB::table('jobs')->count(),
            'failed_last_24h' => DB::table('failed_jobs')->where('failed_at', '>=', $now->subDay())->count(),
            'failed_total' => DB::table('failed_jobs')->count(),
        ];
    }

    /**
     * @return array{local: array{age_hours: float|null}, offsite: array{latest_date: string|null, days_behind: int|null, error: string|null}}
     */
    private function backups(CarbonImmutable $now, CarbonImmutable $local): array
    {
        $files = glob(((string) config('pibls.backup.path')).'/db-*.sql.gz.enc') ?: [];
        $newest = $files === [] ? null : max(array_map('filemtime', $files));

        $offsite = ['latest_date' => null, 'days_behind' => null, 'error' => null];
        try {
            $dates = [];
            foreach (Storage::disk((string) config('pibls.backup.offsite_disk'))->files('db/daily') as $key) {
                if (preg_match('/(\d{4}-\d{2}-\d{2})\.sql\.gz\.enc$/', $key, $match) === 1) {
                    $dates[] = $match[1];
                }
            }
            if ($dates !== []) {
                $latest = max($dates);
                $offsite['latest_date'] = $latest;
                $offsite['days_behind'] = (int) CarbonImmutable::parse($latest, self::TIMEZONE)->startOfDay()->diffInDays($local->startOfDay(), true);
            }
        } catch (Throwable $e) {
            $offsite['error'] = $e->getMessage();
        }

        return [
            'local' => ['age_hours' => $newest === null ? null : round(($now->getTimestamp() - $newest) / 3600, 1)],
            'offsite' => $offsite,
        ];
    }

    /**
     * @return array{uploads_bytes: int, backups_bytes: int, files: int}
     */
    private function disk(): array
    {
        [$uploadsBytes, $uploadsFiles] = self::directorySize((string) config('filesystems.disks.uploads.root'));
        [$backupsBytes, $backupsFiles] = self::directorySize((string) config('pibls.backup.path'));

        return ['uploads_bytes' => $uploadsBytes, 'backups_bytes' => $backupsBytes, 'files' => $uploadsFiles + $backupsFiles];
    }

    /**
     * @return array{0: int, 1: int} bytes e quantidade de arquivos (os inodes que a hospedagem conta)
     */
    private static function directorySize(string $directory): array
    {
        if ($directory === '' || ! is_dir($directory)) {
            return [0, 0];
        }

        $bytes = 0;
        $files = 0;
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, RecursiveDirectoryIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $bytes += $file->getSize();
                $files++;
            }
        }

        return [$bytes, $files];
    }

    /**
     * @return array{total: int, by_type: array<string, int>}
     */
    private function staleLeads(CarbonImmutable $now): array
    {
        /** @var array<string, int> $counts */
        $counts = DB::table('leads_messages')
            ->where('status', 'NOVO')
            ->where('status_changed_at', '<', $now->subDays(self::STALE_LEAD_DAYS))
            ->selectRaw('type, COUNT(*) AS total')
            ->groupBy('type')
            ->pluck('total', 'type')
            ->map(fn ($total): int => (int) $total)
            ->all();

        $byType = [];
        foreach (self::LEAD_TYPES as $type) {
            if (($counts[$type] ?? 0) > 0) {
                $byType[$type] = $counts[$type];
            }
        }

        return ['total' => array_sum($byType), 'by_type' => $byType];
    }

    /**
     * O que merece olhar hoje, em frases. O resumo mostra no topo; vazio quando está tudo em ordem.
     *
     * @param  array<string, mixed>  $report
     * @return list<string>
     */
    private function attention(array $report): array
    {
        $messages = [];

        foreach ($report['latency'] as $row) {
            if (! $row['within_target']) {
                $messages[] = "p95 de {$row['route']}: {$row['p95']} ms (meta {$row['target']} ms).";
            }
        }
        if ($report['requests']['server_errors'] > 0) {
            $messages[] = "{$report['requests']['server_errors']} resposta(s) 5xx ({$report['requests']['error_rate']}% das requisições).";
        }
        if ($report['queue']['failed_last_24h'] > 0) {
            $messages[] = "{$report['queue']['failed_last_24h']} e-mail(s) com falha definitiva nas últimas 24 h.";
        }

        $age = $report['backups']['local']['age_hours'];
        if ($age === null) {
            $messages[] = 'Nenhum dump local encontrado.';
        } elseif ($age > self::LOCAL_BACKUP_MAX_HOURS) {
            $messages[] = 'Último dump local com mais de '.self::LOCAL_BACKUP_MAX_HOURS.' h ('.rtrim(rtrim(number_format($age, 1, '.', ''), '0'), '.').' h).';
        }

        $offsite = $report['backups']['offsite'];
        if ($offsite['error'] !== null) {
            $messages[] = "Não foi possível consultar o B2: {$offsite['error']}";
        } elseif ($offsite['latest_date'] === null) {
            $messages[] = 'Nenhuma cópia encontrada no B2.';
        } elseif ($offsite['days_behind'] > self::OFFSITE_MAX_DAYS_BEHIND) {
            $messages[] = "A última cópia no B2 é de {$offsite['latest_date']} ({$offsite['days_behind']} dias de atraso).";
        }

        $stale = $report['stale_leads']['total'];
        if ($stale > 0) {
            $messages[] = $stale === 1
                ? '1 contato novo esperando há mais de '.self::STALE_LEAD_DAYS.' dias.'
                : "{$stale} contatos novos esperando há mais de ".self::STALE_LEAD_DAYS.' dias.';
        }

        return $messages;
    }

    /**
     * Resumo mensal (SC-003, SC-004, SC-006, SC-019 e a disponibilidade), do mês anterior, para a liderança.
     *
     * @return array<string, mixed>
     */
    private function monthly(CarbonImmutable $local, LogReader $logs): array
    {
        $start = $local->subMonthNoOverflow()->startOfMonth();
        $end = $start->addMonth();
        $from = $start->utc();
        $to = $end->utc();

        $leads = [];
        foreach (self::LEAD_TYPES as $type) {
            $month = DB::table('leads_messages')->where('type', $type)->where('created_at', '>=', $from)->where('created_at', '<', $to);
            $leads[$type] = [
                'received' => (clone $month)->count(),
                'concluded' => (clone $month)->where('status', 'CONCLUIDO')->count(),
            ];
        }

        // SC-003: fichas de visitante e "quero ser membro" concluídas em até 7 dias do envio
        $people = DB::table('leads_messages')->whereIn('type', ['VISITANTE', 'MEMBRO'])->where('created_at', '>=', $from)->where('created_at', '<', $to);
        $received = (clone $people)->count();
        $within = (clone $people)->where('status', 'CONCLUIDO')->whereRaw('status_changed_at <= DATE_ADD(created_at, INTERVAL 7 DAY)')->count();

        return [
            'month' => $start->format('Y-m'),
            'label' => $start->locale('pt_BR')->translatedFormat('F \d\e Y'),
            'leads' => $leads,
            'concluded_in_7_days_rate' => $received === 0 ? null : round(100 * $within / $received, 1),
            'median_first_change_hours' => $this->medianFirstChangeHours($from, $to),
            'bulletins' => $this->bulletinWeeks($start, $end),
            'mail_delay_p95_seconds' => $this->mailDelayP95($logs, $from, $to),
            'availability_percent' => $this->uptime->availability($from, $to),
        ];
    }

    /** SC-004: mediana, em horas, entre o envio e a primeira mudança de status (anotação sem troca de status não conta). */
    private function medianFirstChangeHours(CarbonImmutable $from, CarbonImmutable $to): ?float
    {
        $rows = DB::table('leads_messages as l')
            ->join('lead_activities as a', function ($join): void {
                $join->on('a.lead_id', '=', 'l.id')->whereNotNull('a.to_status');
            })
            ->where('l.created_at', '>=', $from)->where('l.created_at', '<', $to)
            ->groupBy('l.id', 'l.created_at')
            ->selectRaw('l.created_at AS created_at, MIN(a.created_at) AS first_change_at')
            ->get();

        $hours = $rows
            ->map(fn (object $row): float => (CarbonImmutable::parse($row->first_change_at)->getTimestamp() - CarbonImmutable::parse($row->created_at)->getTimestamp()) / 3600)
            ->sort()
            ->values()
            ->all();

        if ($hours === []) {
            return null;
        }

        $middle = intdiv(count($hours), 2);
        $median = count($hours) % 2 === 1 ? $hours[$middle] : ($hours[$middle - 1] + $hours[$middle]) / 2;

        return round($median, 1);
    }

    /**
     * SC-006: semanas (domingos) do mês, a partir do go-live, com o boletim publicado até as 8h do domingo.
     *
     * @return array{on_time: int, weeks: int}
     */
    private function bulletinWeeks(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $goLive = config('pibls.report.go_live_date');
        $goLiveDate = is_string($goLive) && $goLive !== '' ? CarbonImmutable::parse($goLive, self::TIMEZONE)->startOfDay() : null;

        $weeks = 0;
        $onTime = 0;
        for ($sunday = $start; $sunday->lt($end); $sunday = $sunday->addDay()) {
            if ($sunday->dayOfWeek !== 0 || ($goLiveDate !== null && $sunday->lt($goLiveDate))) {
                continue;
            }
            $weeks++;
            $deadline = $sunday->setTime(8, 0)->utc();
            $published = DB::table('bulletins')
                ->whereNull('deleted_at')
                ->where('reference_date', $sunday->format('Y-m-d'))
                ->where('published_at', '<=', $deadline)
                ->exists();
            $onTime += $published ? 1 : 0;
        }

        return ['on_time' => $onTime, 'weeks' => $weeks];
    }

    /** SC-019: p95, em segundos, do atraso entre enfileirar e enviar os avisos (log `mail.sent`). */
    private function mailDelayP95(LogReader $logs, CarbonImmutable $from, CarbonImmutable $to): ?float
    {
        $delays = [];
        foreach ($logs->lines($from, $to) as $line) {
            $delay = is_array($line['context'] ?? null) ? ($line['context']['delayMs'] ?? null) : null;
            if (($line['message'] ?? null) === 'mail.sent' && is_int($delay)) {
                $delays[] = $delay;
            }
        }

        $p95 = LogReader::percentile($delays, 95);

        return $p95 === null ? null : round($p95 / 1000, 1);
    }
}
