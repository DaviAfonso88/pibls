<?php

declare(strict_types=1);

namespace App\Modules\Platform\Listeners;

use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use Illuminate\Contracts\Events\ShouldHandleEventsAfterCommit;

/**
 * Regenera os snapshots na própria requisição que alterou o dado, mas só depois do commit: se a transação desfaz,
 * o arquivo público não pode ficar com a mudança. Roda síncrono (sem fila), para a mudança aparecer em até 1 min.
 */
final class RegenerateSnapshots implements ShouldHandleEventsAfterCommit
{
    public function __construct(private readonly SnapshotRegenerator $regenerator) {}

    public function handle(PublicContentChanged $event): void
    {
        // Falha de uma definição é registrada e reportada pelo regenerador; a operação do usuário já está salva
        $this->regenerator->refresh($event->snapshots === [] ? null : $event->snapshots);
    }
}
