<?php

declare(strict_types=1);

namespace App\Modules\Events\Policies;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use Illuminate\Auth\Access\Response;

/**
 * Quem pode ver e mexer nos eventos (CAP-12; BR-030, BR-075, BR-076).
 *
 * - `eventos.write` vale para qualquer ministério; `eventos.write.own`, só para o do usuário. Sem ministério vinculado, a
 *   permissão `.own` não concede nada (BR-075, 403).
 * - Evento de outro ministério, para quem só tem `.own`, "não existe": 404 (BR-030).
 * - Quem não tem nenhuma permissão de escrita de eventos recebe 403.
 */
final class EventPolicy
{
    public function __construct(private readonly PermissionGate $gate) {}

    /** A lista do painel: quem escreve ou lê inscritos de eventos, de todos ou do próprio ministério. */
    public function viewAny(User $user): Response
    {
        $keys = [
            PermissionKey::EventosWrite, PermissionKey::EventosWriteOwn,
            PermissionKey::EventosInscricoesRead, PermissionKey::EventosInscricoesReadOwn,
        ];

        foreach ($keys as $key) {
            if ($this->gate->allows($user, $key)) {
                return Response::allow();
            }
        }

        return Response::deny(__('errors.forbidden'));
    }

    /**
     * Criar um evento num ministério (o do corpo do pedido). Sem ministério no pedido (campo que falta ou não é número), basta
     * poder escrever em algum: quem fala é a validação (422), não a permissão.
     */
    public function create(User $user, ?int $ministryId = null): Response
    {
        $allowed = $ministryId === null
            ? $this->gate->allows($user, PermissionKey::EventosWrite) || $this->gate->allows($user, PermissionKey::EventosWriteOwn)
            : $this->canWriteIn($user, $ministryId);

        return $allowed ? Response::allow() : Response::deny(__('errors.forbidden'));
    }

    /** Ver, alterar, publicar, excluir e trocar o banner de um evento. */
    public function manage(User $user, Event $event): Response
    {
        if ($this->canWriteIn($user, $event->ministry_id)) {
            return Response::allow();
        }

        // Tem escrita só no próprio ministério e o evento é de outro: não revela que existe
        return $this->gate->allows($user, PermissionKey::EventosWriteOwn)
            ? Response::denyAsNotFound(__('business.BR-030'))
            : Response::deny(__('errors.forbidden'));
    }

    /** Passar um evento para outro ministério: precisa poder escrever nos dois. */
    public function moveTo(User $user, int $ministryId): Response
    {
        return $this->canWriteIn($user, $ministryId) ? Response::allow() : Response::deny(__('errors.forbidden'));
    }

    private function canWriteIn(User $user, int $ministryId): bool
    {
        return $this->gate->allows($user, PermissionKey::EventosWrite)
            || $this->gate->allows($user, PermissionKey::EventosWriteOwn, $ministryId);
    }
}
