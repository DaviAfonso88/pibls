<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Models\Event;

/**
 * O evento publicado de um endereço, para a página com meta injetada (ADR-004). Rascunho, inexistente ou com a flag
 * `events` desligada dá `null`: a página responde 404, sem revelar que o rascunho existe.
 */
final class FindPublishedEvent
{
    public function __invoke(string $slug): ?Event
    {
        if (config('features.events') !== true) {
            return null;
        }

        return Event::query()
            ->with('ministry:id,name')
            ->where('slug', $slug)
            ->where('is_published', true)
            ->first();
    }
}
