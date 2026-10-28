<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use Illuminate\Console\Scheduling\Event;

/**
 * Heartbeat no Healthchecks.io (I-08): um ping ao fim de cada execução bem-sucedida e um `/fail` na falha.
 * A ausência do ping por mais de 15 min é o alerta de "cron parado" (Observability → Alertas).
 * Sem URL (local e CI) não faz nada.
 */
final class Heartbeat
{
    public static function attach(Event $event, ?string $pingUrl): Event
    {
        if ($pingUrl === null || trim($pingUrl) === '') {
            return $event;
        }

        $url = rtrim(trim($pingUrl), '/');

        return $event->pingOnSuccess($url)->pingOnFailure($url.'/fail');
    }
}
