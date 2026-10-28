<?php

declare(strict_types=1);

namespace App\Modules\Content\Snapshots;

use App\Modules\Content\Actions\LoadPublicSettings;
use App\Modules\Platform\Snapshots\SnapshotDefinition;
use Carbon\CarbonInterface;

/**
 * `data/settings.json` (contracts/snapshots.md): igual a `GET /api/public/settings`, com `features`.
 */
final class SettingsSnapshot implements SnapshotDefinition
{
    public function __construct(private readonly LoadPublicSettings $load) {}

    public function name(): string
    {
        return 'settings';
    }

    public function build(): array
    {
        return ($this->load)();
    }

    public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
    {
        // As configurações mudam só pelo painel, que já regenera o arquivo
        return false;
    }
}
