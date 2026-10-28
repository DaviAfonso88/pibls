<?php

declare(strict_types=1);

namespace App\Modules\Platform\Snapshots;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Regenera os snapshots públicos. Três gatilhos (contracts/snapshots.md): o evento `PublicContentChanged`, o comando
 * agendado `pibls:snapshots:refresh-scheduled` e a ativação de release (`pibls:snapshots:refresh`).
 */
final class SnapshotRegenerator
{
    private const LAST_SCHEDULED_RUN_KEY = 'snapshots.scheduled.last_run';

    /** Na primeira execução não há marca anterior: olha para trás o equivalente a dois ciclos do cron. */
    private const FIRST_RUN_LOOKBACK_MINUTES = 10;

    public function __construct(
        private readonly SnapshotRegistry $registry,
        private readonly SnapshotWriter $writer,
        private readonly Cache $cache,
    ) {}

    /**
     * Regenera os snapshots indicados (ou todos). Uma definição que falha não impede as demais; os nomes que
     * falharam voltam em `failed`.
     *
     * @param  list<string>|null  $names
     * @return array{written: list<string>, failed: list<string>}
     */
    public function refresh(?array $names = null): array
    {
        $written = [];
        $failed = [];

        foreach ($this->registry->only($names) as $name => $definition) {
            try {
                $this->writer->write($name, $definition->build());
                $written[] = $name;
            } catch (Throwable $e) {
                $failed[] = $name;
                // A mensagem pode carregar dado do banco; o log e o Sentry passam pelos filtros de PII
                Log::error('snapshots.refresh_failed', ['snapshot' => $name, 'exception' => $e]);
                report($e);
            }
        }

        return ['written' => $written, 'failed' => $failed];
    }

    /**
     * Regenera só os snapshots cujo conteúdo agendado passou a valer desde a última execução (BR-042).
     *
     * @return array{written: list<string>, failed: list<string>}
     */
    public function refreshScheduled(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now('UTC');
        $last = $this->cache->get(self::LAST_SCHEDULED_RUN_KEY);
        $since = is_numeric($last)
            ? CarbonImmutable::createFromTimestampUTC((int) $last)
            : $now->subMinutes(self::FIRST_RUN_LOOKBACK_MINUTES);

        $due = [];
        foreach ($this->registry->all() as $name => $definition) {
            if ($definition->hasScheduledChange($since, $now)) {
                $due[] = $name;
            }
        }

        $result = $due === [] ? ['written' => [], 'failed' => []] : $this->refresh($due);

        // Com falha, a marca não avança (e a primeira fica gravada): a próxima execução tenta o mesmo intervalo de novo
        $this->cache->forever(
            self::LAST_SCHEDULED_RUN_KEY,
            ($result['failed'] === [] ? $now : $since)->getTimestamp(),
        );

        return $result;
    }
}
