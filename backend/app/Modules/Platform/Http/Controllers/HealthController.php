<?php

declare(strict_types=1);

namespace App\Modules\Platform\Http\Controllers;

use App\Modules\Platform\Actions\CheckHealth;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/health`: 200 com a release ativa, ou 503. Nunca expõe detalhe interno.
 * É o que o UptimeRobot e o passo final do deploy consultam (DevOps → Pipeline de CD).
 */
final class HealthController
{
    public function __invoke(CheckHealth $health): JsonResponse
    {
        $response = $health()
            ? response()->json(['status' => 'ok', 'release' => config('pibls.release')])
            : response()->json(['status' => 'degraded'], 503);

        // Estado ao vivo: nunca pode vir de cache
        return $response->header('Cache-Control', 'no-store');
    }
}
