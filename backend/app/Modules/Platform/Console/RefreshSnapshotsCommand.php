<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use Illuminate\Console\Command;
use InvalidArgumentException;

/**
 * `pibls:snapshots:refresh`: regenera todos os snapshots (ou os indicados). O ativador chama este comando ao ativar
 * uma release (DevOps → Ativador, passo 9).
 */
final class RefreshSnapshotsCommand extends Command
{
    protected $signature = 'pibls:snapshots:refresh {--only=* : Nome de um snapshot (settings, ministries, home); repita para vários}';

    protected $description = 'Regenera os snapshots JSON públicos em data/';

    public function handle(SnapshotRegenerator $regenerator): int
    {
        /** @var list<string> $only */
        $only = array_values(array_filter((array) $this->option('only'), 'is_string'));

        try {
            $result = $regenerator->refresh($only === [] ? null : $only);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::INVALID;
        }

        foreach ($result['written'] as $name) {
            $this->info("Snapshot {$name} regenerado.");
        }
        foreach ($result['failed'] as $name) {
            $this->error("Falha ao regenerar o snapshot {$name}.");
        }

        if ($result['written'] === [] && $result['failed'] === []) {
            $this->comment('Nenhum snapshot registrado.');
        }

        return $result['failed'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
