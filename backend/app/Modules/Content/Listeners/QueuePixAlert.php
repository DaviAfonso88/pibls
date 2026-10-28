<?php

declare(strict_types=1);

namespace App\Modules\Content\Listeners;

use App\Modules\Content\Events\PixSettingsChanged;
use App\Modules\Content\Mail\PixAlertMail;
use Illuminate\Support\Facades\Mail;

/**
 * Grava na fila de e-mails um alerta por destinatário de `PIX_ALERT_RECIPIENTS`, na mesma transação da alteração
 * (ADR-003). Os destinatários vêm do `.env`, fora do painel: quem invade uma conta do painel não consegue silenciar o aviso.
 * Sem destinatário a alteração nem chega aqui (BR-063).
 */
final class QueuePixAlert
{
    public function handle(PixSettingsChanged $event): void
    {
        /** @var list<string> $recipients */
        $recipients = array_values((array) config('pibls.pix_alert_recipients', []));

        foreach ($recipients as $address) {
            Mail::to($address)->queue(new PixAlertMail(
                $event->actorName,
                $event->changedFields,
                $event->after['pix_key'],
                $event->after['beneficiary_name'],
                $event->at,
            ));
        }
    }
}
