<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use Illuminate\Support\Facades\DB;

/**
 * Exclui uma inscrição em definitivo e, com isso, devolve a vaga (BR-034, BR-081): as vagas são contadas pelas inscrições
 * que existem. O motivo decide a ação auditada; a auditoria guarda só o evento e o motivo, nunca nome nem telefone.
 */
final class CancelRegistration
{
    public const REASON_CANCELLED = 'CANCELLED';

    public const REASON_DATA_SUBJECT = 'TITULAR_REQUEST';

    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(EventRegistration $registration, User $actor, string $reason): void
    {
        DB::transaction(function () use ($registration, $reason): void {
            $id = $registration->getKey();
            $eventId = $registration->event_id;

            $registration->delete();

            $this->audit->record(
                $reason === self::REASON_DATA_SUBJECT ? AuditAction::RegistrationErased : AuditAction::RegistrationCancelled,
                'event_registration',
                $id,
                ['event_id' => $eventId, 'reason' => $reason],
            );
        });
    }
}
