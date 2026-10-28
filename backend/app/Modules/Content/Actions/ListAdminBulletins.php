<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Enums\PublicationStatus;
use App\Modules\Content\Models\Bulletin;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Lista do painel: todos os boletins não excluídos, inclusive os agendados (CAP-02).
 */
final class ListAdminBulletins
{
    public const DEFAULT_PER_PAGE = 25;

    public const MAX_PER_PAGE = 100;

    /**
     * @param  string  $sort  `-reference_date` (padrão) ou `-edition_number`
     * @return LengthAwarePaginator<int, Bulletin>
     */
    public function __invoke(
        ?int $year = null,
        ?PublicationStatus $status = null,
        string $sort = '-reference_date',
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
    ): LengthAwarePaginator {
        $query = Bulletin::query()->with('updater');

        if ($year !== null) {
            $query->whereYear('reference_date', $year);
        }

        if ($status === PublicationStatus::Agendado) {
            $query->where('published_at', '>', now());
        } elseif ($status === PublicationStatus::Publicado) {
            $query->where('published_at', '<=', now());
        }

        $sort === '-edition_number'
            ? $query->orderByDesc('edition_number')
            : $query->orderByDesc('reference_date')->orderByDesc('edition_number');

        return $query->paginate(perPage: min($perPage, self::MAX_PER_PAGE), page: $page);
    }
}
