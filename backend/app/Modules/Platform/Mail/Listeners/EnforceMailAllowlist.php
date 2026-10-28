<?php

declare(strict_types=1);

namespace App\Modules\Platform\Mail\Listeners;

use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Log;

/**
 * Homologação (ADR-017): só os endereços da allowlist (`MAIL_ALLOWLIST`) recebem e-mail de verdade. Qualquer outro
 * destinatário cancela o envio, para que um teste com dados copiados nunca escreva para o público.
 *
 * Com a lista vazia (produção, local e CI) não há restrição. Devolver `false` cancela o envio no Laravel.
 */
final class EnforceMailAllowlist
{
    public function handle(MessageSending $event): ?bool
    {
        $allowed = array_map('mb_strtolower', (array) config('pibls.mail_allowlist', []));
        if ($allowed === []) {
            return null;
        }

        $message = $event->message;
        $recipients = [...$message->getTo(), ...$message->getCc(), ...$message->getBcc()];

        foreach ($recipients as $recipient) {
            if (! in_array(mb_strtolower($recipient->getAddress()), $allowed, true)) {
                // Só a contagem: o endereço é dado pessoal e não vai para o log
                Log::warning('mail.blocked_by_allowlist', ['recipients' => count($recipients)]);

                return false;
            }
        }

        return null;
    }
}
