<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Models\Event;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * `GET /api/public/events`: só os eventos publicados, 12 por página. Os próximos vêm primeiro, do mais perto ao mais
 * longe; com `include_past`, os que já aconteceram vêm depois, do mais recente ao mais antigo. Rascunho nunca aparece.
 */
final class ListPublicEvents
{
    public const PER_PAGE = 12;

    /**
     * @return LengthAwarePaginator<int, Event>
     */
    public function __invoke(bool $includePast = false, int $page = 1): LengthAwarePaginator
    {
        $at = now()->utc()->format('Y-m-d H:i:s');

        // SQL cru só com literais e bindings (regra de arquitetura)
        return Event::query()
            ->with('ministry:id,name')
            ->withCount('registrations')
            ->where('is_published', true)
            ->when(! $includePast, fn ($query) => $query->whereRaw('coalesce(ends_at, starts_at) >= ?', [$at]))
            ->orderByRaw('case when coalesce(ends_at, starts_at) >= ? then 0 else 1 end', [$at])
            ->orderByRaw('case when coalesce(ends_at, starts_at) >= ? then starts_at end asc', [$at])
            ->orderByDesc('starts_at')
            ->orderBy('id')
            ->paginate(perPage: self::PER_PAGE, page: $page);
    }
}
