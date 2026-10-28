<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

use function Sentry\configureScope;

/**
 * Correlation ID (Observability → Correlation ID). Aceita o `X-Request-Id` da SPA se for um ULID válido; senão gera um.
 *
 * O id volta no cabeçalho de resposta e em `error.traceId`, e segue para o contexto do log, as tags do Sentry,
 * `audit_logs.correlation_id` e o payload dos jobs (o `Context` do Laravel viaja com o job enfileirado).
 */
final class RequestId
{
    public const HEADER = 'X-Request-Id';

    public const ATTRIBUTE = 'request_id';

    public const CONTEXT_KEY = 'request_id';

    public function handle(Request $request, Closure $next): Response
    {
        $id = self::resolve($request->header(self::HEADER));

        $request->attributes->set(self::ATTRIBUTE, $id);
        Context::add(self::CONTEXT_KEY, $id);
        configureScope(static fn ($scope) => $scope->setTag('correlationId', $id));

        $response = $next($request);
        $response->headers->set(self::HEADER, $id);

        return $response;
    }

    /** O id da requisição em andamento (ou `null` fora de uma requisição, como num comando do console). */
    public static function current(?Request $request = null): ?string
    {
        $fromRequest = $request?->attributes->get(self::ATTRIBUTE);
        if (is_string($fromRequest)) {
            return $fromRequest;
        }

        $fromContext = Context::get(self::CONTEXT_KEY);

        return is_string($fromContext) ? $fromContext : null;
    }

    /** ULID de 26 caracteres (Crockford base32) é aceito; qualquer outra coisa é descartada. */
    public static function isValid(?string $value): bool
    {
        return $value !== null && preg_match('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i', $value) === 1;
    }

    private static function resolve(?string $received): string
    {
        return self::isValid($received)
            ? strtoupper((string) $received)
            : strtoupper((string) Str::ulid());
    }
}
