<?php

declare(strict_types=1);

namespace App\Modules\Platform\Snapshots;

use Carbon\CarbonInterface;

/**
 * As seções de snapshot registradas pelos módulos (ver `SnapshotSection`). Singleton, preenchido na inicialização.
 */
final class SnapshotSections
{
    /** @var list<SnapshotSection> */
    private array $sections = [];

    public function register(SnapshotSection $section): void
    {
        $this->sections[] = $section;
    }

    /**
     * Aplica as seções do snapshot sobre os dados que o dono montou.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function apply(string $snapshot, array $data): array
    {
        foreach ($this->sections as $section) {
            if ($section->snapshot() === $snapshot) {
                $data[$section->key()] = $section->build();
            }
        }

        return $data;
    }

    public function hasScheduledChange(string $snapshot, CarbonInterface $since, CarbonInterface $until): bool
    {
        foreach ($this->sections as $section) {
            if ($section->snapshot() === $snapshot && $section->hasScheduledChange($since, $until)) {
                return true;
            }
        }

        return false;
    }
}
