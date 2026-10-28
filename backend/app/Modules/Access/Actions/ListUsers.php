<?php

declare(strict_types=1);

namespace App\Modules\Access\Actions;

use App\Modules\Access\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Diretório de usuários, somente leitura (BG-4; BR-077): quem tem acesso ao painel e o que pode fazer. A aplicação
 * nunca cria nem altera usuários e permissões; isso é feito no phpMyAdmin.
 */
final class ListUsers
{
    public const DEFAULT_PER_PAGE = 25;

    public const MAX_PER_PAGE = 100;

    /**
     * @return LengthAwarePaginator<int, User>
     */
    public function __invoke(
        ?bool $isActive = null,
        ?int $ministryId = null,
        bool $descending = false,
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
    ): LengthAwarePaginator {
        return User::query()
            ->with(['ministry', 'permissions'])
            ->when($isActive !== null, fn ($query) => $query->where('is_active', $isActive))
            ->when($ministryId !== null, fn ($query) => $query->where('ministry_id', $ministryId))
            ->orderBy('name', $descending ? 'desc' : 'asc')
            ->orderBy('id')
            ->paginate(perPage: min($perPage, self::MAX_PER_PAGE), page: $page);
    }
}
