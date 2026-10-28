<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Feature flag por rota (`middleware('feature:events')`). Com a flag desligada a rota responde 404, como se não
 * existisse: é assim que o R1 vai ao ar com os eventos desligados (`FEATURE_EVENTS=false`).
 * As flags ficam em `config/features.php` e vêm do `.env`.
 */
final class EnsureFeatureEnabled
{
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        if (config("features.{$feature}") !== true) {
            throw new NotFoundHttpException;
        }

        return $next($request);
    }
}
