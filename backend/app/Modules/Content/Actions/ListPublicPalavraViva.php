<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * `GET /api/public/palavra-viva`: as mensagens já publicadas (BR-042), 10 por página, da mais recente à mais antiga. A busca
 * (`q`) procura o termo no título, no resumo e no texto; a collation do banco ignora maiúsculas e acentos ("oracao" acha
 * "Oração").
 */
final class ListPublicPalavraViva
{
    public const PER_PAGE = 10;

    /**
     * @return LengthAwarePaginator<int, PalavraVivaPost>
     */
    public function __invoke(int $page = 1, ?string $search = null): LengthAwarePaginator
    {
        $term = $search === null ? '' : trim(preg_replace('/\s+/u', ' ', $search) ?? '');

        return PalavraVivaPost::query()
            ->published()
            ->when($term !== '', function (Builder $query) use ($term): void {
                $like = '%'.addcslashes($term, '%_\\').'%';

                $query->where(fn (Builder $inner) => $inner
                    ->where('title', 'like', $like)
                    ->orWhere('excerpt', 'like', $like)
                    ->orWhere('body', 'like', $like));
            })
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate(perPage: self::PER_PAGE, page: $page);
    }
}
