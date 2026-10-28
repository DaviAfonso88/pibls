<?php

declare(strict_types=1);

namespace App\Modules\Events\Listeners;

use App\Modules\Events\Events\RegistrationCreated;
use App\Modules\Events\Mail\RegistrationConfirmationMail;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Support\Facades\Mail;

/**
 * Grava na fila de e-mails a confirmação da inscrição, na mesma transação dela (ADR-003), só se a pessoa informou
 * e-mail. Síncrono de propósito: se a gravação da fila falhar, a inscrição desfaz junto. Já a falha do SMTP, que acontece
 * depois, na hora de enviar, nunca desfaz a inscrição (FR-019).
 */
final class QueueRegistrationConfirmation
{
    public function handle(RegistrationCreated $created): void
    {
        $registration = EventRegistration::query()->with('event')->findOrFail($created->registrationId);

        if ($registration->email === null) {
            return;
        }

        Mail::to($registration->email)->queue(new RegistrationConfirmationMail($registration));
    }
}
