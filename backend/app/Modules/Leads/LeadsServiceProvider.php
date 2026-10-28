<?php

declare(strict_types=1);

namespace App\Modules\Leads;

use App\Modules\Leads\Events\LeadAssigned;
use App\Modules\Leads\Events\LeadErased;
use App\Modules\Leads\Events\LeadReceived;
use App\Modules\Leads\Events\LeadStatusChanged;
use App\Modules\Leads\Listeners\AuditLeadChanges;
use App\Modules\Leads\Listeners\QueueLeadNotifications;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Policies\LeadPolicy;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class LeadsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Síncrono, de propósito: os avisos entram na fila na transação do contato
        Event::listen(LeadReceived::class, [QueueLeadNotifications::class, 'handle']);

        // Auditoria do atendimento (sem dado pessoal), na transação do atendimento
        Event::listen(LeadStatusChanged::class, [AuditLeadChanges::class, 'statusChanged']);
        Event::listen(LeadAssigned::class, [AuditLeadChanges::class, 'assigned']);
        Event::listen(LeadErased::class, [AuditLeadChanges::class, 'erased']);

        Gate::policy(Lead::class, LeadPolicy::class);
    }
}
