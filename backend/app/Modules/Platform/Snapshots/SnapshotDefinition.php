<?php

declare(strict_types=1);

namespace App\Modules\Platform\Snapshots;

use Carbon\CarbonInterface;

/**
 * Um arquivo de `public_html/data/` (ADR-014). A Platform só conhece este contrato: quem sabe montar o conteúdo é o
 * módulo dono do dado (Content, Ministries, Events), que registra a sua definição em `SnapshotRegistry`. Assim a
 * Platform continua sem depender de módulo de negócio.
 *
 * O conteúdo sai do MESMO serializador (Resource) da API pública equivalente; um teste de contrato compara os dois.
 */
interface SnapshotDefinition
{
    /** Nome do arquivo, sem extensão: `settings`, `ministries`, `home`. */
    public function name(): string;

    /**
     * O que vai em `data` no arquivo. Nunca pode conter `notification_recipients`, `private_address`,
     * `contact_email` nem conteúdo agendado (BR-042, BR-048, BR-050).
     *
     * @return array<array-key, mixed>
     */
    public function build(): array;

    /**
     * Algum conteúdo agendado passou a valer no intervalo `(since, until]`? Se sim, o snapshot é regenerado pelo
     * `pibls:snapshots:refresh-scheduled` (BR-042: conteúdo agendado só entra depois do horário).
     */
    public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool;
}
