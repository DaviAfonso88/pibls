<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * `GET /api/public/palavra-viva`: as mensagens já publicadas (BR-042), 10 por página, da mais recente à mais antiga.
 */
final class ListPublicPalavraViva
{
    public const PER_PAGE = 10;

    /**
     * @return LengthAwarePaginator<int, PalavraVivaPost>
     */
    public function __invoke(int $page = 1): LengthAwarePaginator
    {
        return PalavraVivaPost::query()
            ->published()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate(perPage: self::PER_PAGE, page: $page);
    }
}
