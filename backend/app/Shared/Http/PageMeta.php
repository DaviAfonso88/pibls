<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * O bloco `meta` das listas paginadas da API (`PageMeta` no contrato): `{page, per_page, total, last_page}`.
 */
final class PageMeta
{
    /**
     * @param  LengthAwarePaginator<int, mixed>  $paginator
     * @return array{page: int, per_page: int, total: int, last_page: int}
     */
    public static function of(LengthAwarePaginator $paginator): array
    {
        return [
            'page' => $paginator->currentPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
