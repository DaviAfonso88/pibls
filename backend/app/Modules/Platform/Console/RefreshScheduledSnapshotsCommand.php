<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use Illuminate\Console\Command;

/**
 * `pibls:snapshots:refresh-scheduled`: roda a cada 5 min no agendador e regenera só os snapshots em que um conteúdo
 * agendado passou a valer desde a última execução (BR-042). Sem nada novo, não grava nada.
 */
final class RefreshScheduledSnapshotsCommand extends Command
{
    protected $signature = 'pibls:snapshots:refresh-scheduled';

    protected $description = 'Regenera os snapshots quando um conteúdo agendado passa a valer';

    public function handle(SnapshotRegenerator $regenerator): int
    {
        $result = $regenerator->refreshScheduled();

        foreach ($result['written'] as $name) {
            $this->info("Snapshot {$name} regenerado (conteúdo agendado passou a valer).");
        }
        foreach ($result['failed'] as $name) {
            $this->error("Falha ao regenerar o snapshot {$name}.");
        }

        return $result['failed'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
