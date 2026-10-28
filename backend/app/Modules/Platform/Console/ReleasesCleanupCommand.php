<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Releases\ReleaseCleaner;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * `pibls:releases:cleanup` (semanal): mantém as 5 últimas releases e os `assets/` delas; nunca apaga a ativa nem a
 * anterior. Só faz sentido no servidor (onde o ativador deixou `PIBLS_SHARED_PATH`); fora dele sai sem fazer nada.
 */
final class ReleasesCleanupCommand extends Command
{
    protected $signature = 'pibls:releases:cleanup {--keep=5 : Quantas releases manter}';

    protected $description = 'Apaga as releases antigas do servidor, mantendo as 5 últimas e os assets delas';

    public function handle(ReleaseCleaner $cleaner): int
    {
        $shared = (string) ($_SERVER['PIBLS_SHARED_PATH'] ?? getenv('PIBLS_SHARED_PATH') ?: '');

        if ($shared === '') {
            $this->line('Fora do servidor (sem PIBLS_SHARED_PATH): nada a limpar.');

            return self::SUCCESS;
        }

        try {
            $result = $cleaner->clean(dirname($shared), dirname((string) config('pibls.snapshots_path')), max(2, (int) $this->option('keep')));
        } catch (Throwable $e) {
            report($e);
            Log::error('releases.cleanup_failed', ['reason' => $e->getMessage()]);
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info(sprintf(
            'Releases mantidas: %s. Removidas: %s. Assets removidos: %d.',
            implode(', ', $result['kept']),
            $result['removed'] === [] ? 'nenhuma' : implode(', ', $result['removed']),
            $result['assets_removed'],
        ));

        return self::SUCCESS;
    }
}
