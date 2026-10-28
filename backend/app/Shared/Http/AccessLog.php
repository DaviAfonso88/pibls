<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Access log da aplicação: uma linha `info` por requisição (`warning` se passar de 2 s), com a rota, o status e a
 * duração. Alimenta o p50/p95/p99 por rota do resumo diário (Observability → Métricas).
 *
 * Nunca registra corpo, query string, cabeçalhos nem IP: o caminho entra só como o padrão da rota (`api/admin/leads/{id}`).
 */
final class AccessLog
{
    private const SLOW_REQUEST_MS = 2000;

    private const START_ATTRIBUTE = '_access_log_start';

    public function handle(Request $request, Closure $next): Response
    {
        $request->attributes->set(self::START_ATTRIBUTE, hrtime(true));

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        $start = $request->attributes->get(self::START_ATTRIBUTE);
        $durationMs = is_int($start) ? (int) round((hrtime(true) - $start) / 1_000_000) : null;

        $route = $request->route();
        $action = $route instanceof Route
            ? ($route->getName() ?? $request->method().' /'.ltrim($route->uri(), '/'))
            : $request->method().' (sem rota)';

        $userId = $request->user()?->getAuthIdentifier();

        Log::log(
            $durationMs !== null && $durationMs > self::SLOW_REQUEST_MS ? 'warning' : 'info',
            'http.request',
            [
                'action' => $action,
                'httpStatus' => $response->getStatusCode(),
                'durationMs' => $durationMs,
                'userId' => is_scalar($userId) ? $userId : null,
            ],
        );
    }
}
