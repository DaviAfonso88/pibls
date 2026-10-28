<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Enums\LeadType;
use Illuminate\Validation\ValidationException;

/**
 * Confere o responsável pelo contato (BR-009): usuário ATIVO com a permissão de GESTÃO do tipo do contato. Quem não tem
 * a permissão (ou foi desativado) não pode ser escolhido.
 */
final class AssignLead
{
    public function __invoke(int $assigneeId, LeadType $type): User
    {
        $assignee = User::query()
            ->whereKey($assigneeId)
            ->where('is_active', true)
            ->whereHas('permissions', fn ($query) => $query->where('permission_key', $type->managePermission()->value))
            ->first();

        if ($assignee === null) {
            throw ValidationException::withMessages(['assigned_to' => [__('business.BR-009')]]);
        }

        return $assignee;
    }
}
