<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Enums\LeadType;
use Illuminate\Support\Collection;

/**
 * Quem pode ser responsável por um tipo de contato (BR-009): usuários ativos com a permissão de gestão desse tipo.
 */
final class ListLeadAssignees
{
    /**
     * @return Collection<int, User>
     */
    public function __invoke(LeadType $type): Collection
    {
        return User::query()
            ->where('is_active', true)
            ->whereHas('permissions', fn ($query) => $query->where('permission_key', $type->managePermission()->value))
            ->orderBy('name')
            ->orderBy('id')
            ->get(['id', 'name']);
    }
}
