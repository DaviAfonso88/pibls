<?php

declare(strict_types=1);

namespace App\Modules\Events\Policies;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Auth\Access\Response;

/**
 * Quem vê, exporta e cancela as inscrições de um evento (CAP-15; BR-034, BR-076, BR-081).
 *
 * - Ver e exportar: `eventos.inscricoes.read` (qualquer evento) ou `.read.own` (só os do próprio ministério).
 * - Cancelar (exclusão definitiva): a mesma permissão de escrita do evento, `EventPolicy::manage`.
 * - Quem só tem `.own` e pede um evento de outro ministério recebe 404 (BR-030); quem não tem nenhuma permissão, 403.
 */
final class EventRegistrationPolicy
{
    public function __construct(
        private readonly PermissionGate $gate,
        private readonly EventPolicy $events,
    ) {}

    /** A lista e o CSV das inscrições de um evento. */
    public function viewAny(User $user, Event $event): Response
    {
        if ($this->gate->allows($user, PermissionKey::EventosInscricoesRead)
            || $this->gate->allows($user, PermissionKey::EventosInscricoesReadOwn, $event->ministry_id)) {
            return Response::allow();
        }

        return $this->gate->allows($user, PermissionKey::EventosInscricoesReadOwn)
            ? Response::denyAsNotFound(__('business.BR-030'))
            : Response::deny(__('errors.forbidden'));
    }

    /** O bloco "Inscrições de hoje" do Início: quem lê inscritos de todos ou do próprio ministério (o recorte é da Action). */
    public function viewToday(User $user): Response
    {
        return $this->gate->allows($user, PermissionKey::EventosInscricoesRead)
            || $this->gate->allows($user, PermissionKey::EventosInscricoesReadOwn)
            ? Response::allow()
            : Response::deny(__('errors.forbidden'));
    }

    /** Cancelar uma inscrição, ou excluí-la a pedido do titular. */
    public function delete(User $user, EventRegistration $registration): Response
    {
        return $this->events->manage($user, $registration->event);
    }
}
