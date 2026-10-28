<?php

declare(strict_types=1);

namespace App\Modules\Platform\Snapshots;

use Carbon\CarbonInterface;

/**
 * Um pedaço do `data` de um snapshot que pertence a OUTRO módulo: os próximos eventos na `home.json`, por exemplo. O dono
 * do arquivo (Content) pergunta às seções registradas em `SnapshotSections` e troca o valor padrão da chave pelo que elas
 * devolvem. Assim o Content não depende do Events, e a Platform continua sem depender de módulo de negócio.
 */
interface SnapshotSection
{
    /** Nome do snapshot que recebe a seção (`home`). */
    public function snapshot(): string;

    /** Chave dentro de `data` (`upcoming_events`). */
    public function key(): string;

    /**
     * O valor da chave, no mesmo formato da API pública equivalente.
     *
     * @return array<array-key, mixed>
     */
    public function build(): array;

    /** Algo mudou sozinho, pela passagem do tempo, no intervalo `(since, until]`? Se sim, o snapshot é regenerado. */
    public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool;
}
