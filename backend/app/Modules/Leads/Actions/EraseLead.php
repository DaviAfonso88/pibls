<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Events\LeadErased;
use App\Modules\Leads\Models\Lead;
use Illuminate\Support\Facades\DB;

/**
 * Exclusão definitiva de um contato, a pedido do titular (BR-081, L-02). O histórico de atendimento sai em cascata (FK) e
 * a auditoria guarda só o tipo, o motivo e quem excluiu: nenhum dado pessoal. A auditoria e a exclusão valem juntas ou
 * nenhuma.
 */
final class EraseLead
{
    public const REASON_DATA_SUBJECT = 'TITULAR_REQUEST';

    public function __invoke(Lead $lead, User $actor, string $reason): void
    {
        DB::transaction(function () use ($lead, $actor, $reason): void {
            $id = (int) $lead->getKey();
            $type = LeadType::from($lead->type);

            $lead->delete();

            event(new LeadErased($id, $type, $reason, (int) $actor->getKey()));
        });
    }
}
