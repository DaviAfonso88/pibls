<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Lista do painel: todas as mensagens não excluídas, inclusive as agendadas (CAP-03).
 */
final class ListAdminPalavraViva
{
    public const DEFAULT_PER_PAGE = 25;

    public const MAX_PER_PAGE = 100;

    /**
     * @return LengthAwarePaginator<int, PalavraVivaPost>
     */
    public function __invoke(int $page = 1, int $perPage = self::DEFAULT_PER_PAGE): LengthAwarePaginator
    {
        return PalavraVivaPost::query()
            ->with('updater')
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->paginate(perPage: min($perPage, self::MAX_PER_PAGE), page: $page);
    }
}
