<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\Bulletin;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * `GET /api/public/bulletins`: só os boletins já publicados (BR-042), 12 por página, do mais recente ao mais antigo,
 * com filtro por ano e, dentro do ano, por mês da data de referência.
 */
final class ListPublicBulletins
{
    public const PER_PAGE = 12;

    /**
     * @return LengthAwarePaginator<int, Bulletin>
     */
    public function __invoke(?int $year = null, ?int $month = null, int $page = 1): LengthAwarePaginator
    {
        return Bulletin::query()
            ->published()
            ->when($year !== null, fn ($query) => $query->whereYear('reference_date', $year))
            ->when($year !== null && $month !== null, fn ($query) => $query->whereMonth('reference_date', $month))
            ->orderByDesc('reference_date')
            ->orderByDesc('edition_number')
            ->paginate(perPage: self::PER_PAGE, page: $page);
    }
}
