<?php

declare(strict_types=1);

namespace App\Modules\Leads\Listeners;

use App\Modules\Leads\Events\LeadAssigned;
use App\Modules\Leads\Events\LeadErased;
use App\Modules\Leads\Events\LeadStatusChanged;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;

/**
 * Grava na auditoria o atendimento dos contatos (`lead.status_changed`, `lead.assigned`, `lead.erased`). Síncrono, na
 * transação do atendimento. Só ids, tipo, estados e motivo: nunca nome, telefone, e-mail, mensagem nem anotação.
 */
final class AuditLeadChanges
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function statusChanged(LeadStatusChanged $event): void
    {
        $this->audit->record(
            AuditAction::LeadStatusChanged,
            'lead',
            $event->leadId,
            ['type' => $event->type->value, 'from' => $event->from->value, 'to' => $event->to->value],
            $event->actorId,
        );
    }

    public function assigned(LeadAssigned $event): void
    {
        $this->audit->record(
            AuditAction::LeadAssigned,
            'lead',
            $event->leadId,
            ['type' => $event->type->value, 'assigned_to' => $event->assigneeId],
            $event->actorId,
        );
    }

    public function erased(LeadErased $event): void
    {
        $this->audit->record(
            AuditAction::LeadErased,
            'lead',
            $event->leadId,
            ['type' => $event->type->value, 'reason' => $event->reason],
            $event->actorId,
        );
    }
}
