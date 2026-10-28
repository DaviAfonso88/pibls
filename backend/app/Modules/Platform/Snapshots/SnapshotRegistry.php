<?php

declare(strict_types=1);

namespace App\Modules\Platform\Snapshots;

use InvalidArgumentException;

/**
 * Lista das definições de snapshot. Cada módulo de negócio registra as suas na inicialização (service provider do
 * módulo); a Platform só itera.
 */
final class SnapshotRegistry
{
    /** @var array<string, SnapshotDefinition> */
    private array $definitions = [];

    public function register(SnapshotDefinition $definition): void
    {
        $name = $definition->name();

        if (isset($this->definitions[$name])) {
            throw new InvalidArgumentException("O snapshot {$name} já está registrado.");
        }

        $this->definitions[$name] = $definition;
    }

    /** @return array<string, SnapshotDefinition> indexadas pelo nome */
    public function all(): array
    {
        return $this->definitions;
    }

    /**
     * @param  list<string>|null  $names  `null` = todas
     * @return array<string, SnapshotDefinition>
     */
    public function only(?array $names): array
    {
        if ($names === null) {
            return $this->definitions;
        }

        $unknown = array_diff($names, array_keys($this->definitions));
        if ($unknown !== []) {
            throw new InvalidArgumentException('Snapshot desconhecido: '.implode(', ', $unknown).'.');
        }

        return array_intersect_key($this->definitions, array_flip($names));
    }
}
