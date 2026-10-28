<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Models\Event;

/**
 * `GET /api/public/events/{slug}`: o evento publicado com o ministério e o total de inscritos (as vagas que restam saem
 * daí). Rascunho ou inexistente é 404, sem revelar que o rascunho existe.
 */
final class ShowPublicEvent
{
    public function __invoke(string $slug): Event
    {
        return Event::query()
            ->with('ministry:id,name')
            ->withCount('registrations')
            ->where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();
    }
}
