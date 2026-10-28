<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Events\LeadAssigned;
use App\Modules\Leads\Events\LeadStatusChanged;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use App\Modules\Leads\Support\LeadChanges;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * O atendimento de um contato (CAP-10, CAP-11): status, responsável e anotação numa só operação, com um registro no
 * histórico (`LeadActivity`: quem, o quê, quando). Tudo na mesma transação, com o contato travado, para dois operadores não
 * se atropelarem.
 *
 * Regras (BR-008, BR-009, BR-013): só as transições da tabela; `EM_ATENDIMENTO` exige responsável ativo com a gestão do
 * tipo (se nada for informado, é quem está atendendo); voltar a `NOVO` tira o responsável; um responsável só existe
 * em atendimento.
 */
final class UpdateLead
{
    public function __construct(
        private readonly ChangeLeadStatus $changeStatus,
        private readonly AssignLead $assign,
        private readonly AddLeadNote $addNote,
    ) {}

    public function __invoke(Lead $lead, User $actor, LeadChanges $changes): Lead
    {
        return DB::transaction(function () use ($lead, $actor, $changes): Lead {
            $current = Lead::query()->lockForUpdate()->findOrFail($lead->getKey());
            $type = LeadType::from($current->type);
            $from = LeadStatus::from($current->status);
            $note = ($this->addNote)($changes->note);

            if ($changes->status === null && ! $changes->assigneeGiven && $note === null) {
                throw ValidationException::withMessages(['status' => [__('errors.validation')]]);
            }

            $to = $changes->status === null ? $from : ($this->changeStatus)($from, $changes->status);
            $statusChanged = $to !== $from;

            $assignee = $this->resolveAssignee($current, $type, $to, $statusChanged, $actor, $changes);
            $assigneeChanged = $assignee !== $current->assigned_to;

            $current->status = $to->value;
            $current->assigned_to = $assignee;
            if ($statusChanged) {
                $current->status_changed_at = now();
            }
            $current->save();

            LeadActivity::query()->create([
                'lead_id' => $current->getKey(),
                'actor_user_id' => $actor->getKey(),
                'from_status' => $statusChanged ? $from->value : null,
                'to_status' => $statusChanged ? $to->value : null,
                'assigned_to' => $assignee,
                'note' => $note,
            ]);

            if ($statusChanged) {
                event(new LeadStatusChanged((int) $current->getKey(), $type, $from, $to, (int) $actor->getKey()));
            }
            if ($assigneeChanged) {
                event(new LeadAssigned((int) $current->getKey(), $type, $assignee, (int) $actor->getKey()));
            }

            return $current;
        });
    }

    /** O responsável que o contato terá depois da mudança (BR-009). */
    private function resolveAssignee(
        Lead $lead,
        LeadType $type,
        LeadStatus $to,
        bool $statusChanged,
        User $actor,
        LeadChanges $changes,
    ): ?int {
        if ($to === LeadStatus::Novo) {
            if ($changes->assigneeGiven && $changes->assigneeId !== null) {
                throw ValidationException::withMessages(['assigned_to' => [__('errors.lead_assignee_state')]]);
            }

            return null; // voltar à fila tira o responsável
        }

        if ($changes->assigneeGiven) {
            if ($changes->assigneeId === null) {
                if ($to === LeadStatus::EmAtendimento) {
                    throw ValidationException::withMessages(['assigned_to' => [__('business.BR-009')]]);
                }

                return null;
            }

            return (int) ($this->assign)($changes->assigneeId, $type)->getKey();
        }

        if ($to === LeadStatus::EmAtendimento && ($statusChanged || $lead->assigned_to === null)) {
            // Entrou em atendimento (ou reabriu) sem informar o responsável: é quem está atendendo
            return (int) ($this->assign)((int) $actor->getKey(), $type)->getKey();
        }

        return $lead->assigned_to; // anotação, ou conclusão: o responsável continua o mesmo (BR-012)
    }
}
