<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * As inscrições de um evento, da mais antiga para a mais nova, com busca por nome ou telefone. A lista alimenta o PDF do
 * navegador, então a página pode ter até 500 linhas.
 */
final class ListEventRegistrations
{
    public const DEFAULT_PER_PAGE = 50;

    public const MAX_PER_PAGE = 500;

    /**
     * @return LengthAwarePaginator<int, EventRegistration>
     */
    public function __invoke(Event $event, int $page, int $perPage, ?string $search): LengthAwarePaginator
    {
        $query = $event->registrations()->getQuery();

        $this->search($query, $search);

        return $query->orderBy('created_at')->orderBy('id')->paginate(
            perPage: min(max($perPage, 1), self::MAX_PER_PAGE),
            page: max($page, 1),
        );
    }

    /**
     * @param  Builder<EventRegistration>  $query
     */
    private function search(Builder $query, ?string $search): void
    {
        $term = trim((string) $search);

        if ($term === '') {
            return;
        }

        $digits = preg_replace('/\D/', '', $term) ?? '';

        $query->where(function (Builder $inner) use ($term, $digits): void {
            $inner->where('participant_name', 'like', '%'.self::escapeLike($term).'%');

            if (strlen($digits) >= 3) {
                $inner->orWhere('phone', 'like', '%'.$digits.'%');
            }
        });
    }

    private static function escapeLike(string $value): string
    {
        return addcslashes($value, '%_\\');
    }
}
