<?php

declare(strict_types=1);

namespace App\Modules\Platform\Reports;

use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Disponibilidade do período segundo o UptimeRobot (I-07), para o resumo mensal. Usa uma chave SÓ DE LEITURA
 * (`UPTIMEROBOT_API_KEY`). Qualquer problema (sem chave, API fora, resposta estranha) devolve `null`: a linha some do
 * resumo, e o resumo sai do mesmo jeito.
 */
class UptimeRobot
{
    private const ENDPOINT = 'https://api.uptimerobot.com/v2/getMonitors';

    /** Média da disponibilidade (%) dos monitores no período, com duas casas. */
    public function availability(CarbonInterface $from, CarbonInterface $to): ?float
    {
        $key = trim((string) config('pibls.report.uptimerobot_api_key'));
        if ($key === '') {
            return null;
        }

        try {
            $response = Http::timeout(5)->retry(2, 0, throw: false)->asForm()->post(self::ENDPOINT, [
                'api_key' => $key,
                'format' => 'json',
                'custom_uptime_ranges' => $from->getTimestamp().'_'.$to->getTimestamp(),
            ]);

            if (! $response->successful() || $response->json('stat') !== 'ok') {
                return null;
            }

            $values = [];
            foreach ((array) $response->json('monitors') as $monitor) {
                $range = is_array($monitor) ? ($monitor['custom_uptime_ranges'] ?? null) : null;
                if (is_string($range) && is_numeric($range)) {
                    $values[] = (float) $range;
                }
            }

            return $values === [] ? null : round(array_sum($values) / count($values), 2);
        } catch (Throwable) {
            return null;
        }
    }
}
