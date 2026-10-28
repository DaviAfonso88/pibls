<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Snapshots;

use App\Modules\Ministries\Actions\ListPublicMinistries;
use App\Modules\Platform\Snapshots\SnapshotDefinition;
use Carbon\CarbonInterface;

/**
 * `data/ministries.json` (contracts/snapshots.md): a lista pública sem filtros, igual a `GET /api/public/ministries`.
 * A SPA filtra por categoria e bairro no cliente.
 */
final class MinistriesSnapshot implements SnapshotDefinition
{
    public function __construct(private readonly ListPublicMinistries $list) {}

    public function name(): string
    {
        return 'ministries';
    }

    public function build(): array
    {
        return ($this->list)();
    }

    public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
    {
        // O catálogo não tem conteúdo agendado
        return false;
    }
}
