<?php

declare(strict_types=1);

namespace App\Modules\Platform\Monitoring;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Heartbeat de cada tarefa no Healthchecks.io (I-08). `success` avisa que a tarefa terminou bem; `fail`, que deu errado
 * (o serviço também alerta pela AUSÊNCIA do ping). A URL de cada check vem de `pibls.healthchecks.<check>`; sem URL
 * (local e CI) não faz nada.
 *
 * Resiliência da especificação: timeout de 5 s e uma nova tentativa. Falha no ping NUNCA interrompe a tarefa: vira um
 * `warning` no log, sem a URL (ela é um segredo de fato: quem a conhece pode "avisar" que está tudo bem).
 */
class Healthchecks
{
    private const TIMEOUT_SECONDS = 5;

    public function success(string $check): void
    {
        $this->ping($check, '');
    }

    public function fail(string $check): void
    {
        $this->ping($check, '/fail');
    }

    private function ping(string $check, string $suffix): void
    {
        $url = trim((string) config("pibls.healthchecks.{$check}"));
        if ($url === '') {
            return;
        }

        try {
            Http::timeout(self::TIMEOUT_SECONDS)->retry(2, 0, throw: false)->get(rtrim($url, '/').$suffix);
        } catch (Throwable) {
            Log::warning('healthchecks.ping_failed', ['check' => $check, 'kind' => $suffix === '' ? 'success' : 'fail']);
        }
    }
}
