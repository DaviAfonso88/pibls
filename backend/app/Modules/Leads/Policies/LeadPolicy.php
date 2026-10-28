<?php

declare(strict_types=1);

namespace App\Modules\Leads\Policies;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Models\User;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Models\Lead;
use Illuminate\Auth\Access\Response;

/**
 * Quem pode ver e atender cada contato (CAP-10, CAP-11; BR-007, BR-076). A permissão vale por TIPO: a caixa geral exige
 * `leads.read` e `leads.manage`; o pedido de oração, `leads.oracao.read` e `leads.oracao.manage`, e nunca aparece para
 * quem só tem as da caixa geral.
 *
 * - Sem a permissão de leitura do tipo, o contato "não existe": 404, para não revelar que há um pedido de oração (BR-007).
 * - Lendo, mas sem a permissão de gestão: 403.
 */
final class LeadPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    public function view(User $user, Lead $lead): Response
    {
        return $this->canRead($user, $lead) ? Response::allow() : Response::denyAsNotFound();
    }

    /** Alterar status, responsável e anotação, e excluir. */
    public function manage(User $user, Lead $lead): Response
    {
        if (! $this->canRead($user, $lead)) {
            return Response::denyAsNotFound();
        }

        $type = LeadType::from($lead->type);

        return $this->gate->allows($user, $type->managePermission())
            ? Response::allow()
            : Response::deny(__('errors.forbidden'));
    }

    private function canRead(User $user, Lead $lead): bool
    {
        return $this->gate->allows($user, LeadType::from($lead->type)->readPermission());
    }
}
