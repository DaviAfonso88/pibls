<?php

declare(strict_types=1);

namespace App\Modules\Leads\Listeners;

use App\Modules\Leads\Actions\ResolveLeadRecipients;
use App\Modules\Leads\Events\LeadReceived;
use App\Modules\Leads\Mail\LeadReceivedMail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Grava na fila de e-mails um aviso por destinatário, na mesma transação do contato (ADR-003). Síncrono de propósito:
 * se a gravação da fila falhar, o contato desfaz junto, e se a transação desfizer, os avisos somem.
 *
 * Tipo sem destinatário (BR-011): o contato fica gravado, aparece no painel, e o sistema registra o aviso (sem dado
 * pessoal, só o tipo).
 */
final class QueueLeadNotifications
{
    public function __construct(private readonly ResolveLeadRecipients $recipients) {}

    public function handle(LeadReceived $event): void
    {
        $addresses = ($this->recipients)($event->type, $event->ministryId);

        if ($addresses === []) {
            Log::warning('lead.no_recipients', ['type' => $event->type->value]);

            return;
        }

        foreach ($addresses as $address) {
            Mail::to($address)->queue(new LeadReceivedMail($event->leadId, $event->type, $event->receivedAt));
        }
    }
}
