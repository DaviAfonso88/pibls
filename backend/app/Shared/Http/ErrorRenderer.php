<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\LostConnectionException;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use PDOException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Envelope de erro da API: `{error:{code,message,details,traceId}}` (API Standards → Formato padrão de erro).
 *
 * Só atua nas rotas de API (e em quem pede JSON); as demais seguem o tratamento padrão do Laravel.
 * Nunca devolve detalhe interno: mensagem de exceção inesperada só vai para o log e o Sentry.
 */
final class ErrorRenderer
{
    public static function render(Throwable $e, Request $request): ?JsonResponse
    {
        if (! self::wantsEnvelope($request)) {
            return null;
        }

        $traceId = RequestId::current($request) ?? '';
        [$status, $code, $message, $details, $headers] = self::map($e, $traceId);

        return response()->json(
            ['error' => ['code' => $code, 'message' => $message, 'details' => $details, 'traceId' => $traceId]],
            $status,
            [...$headers, RequestId::HEADER => $traceId, 'Cache-Control' => 'no-store'],
        );
    }

    public static function wantsEnvelope(Request $request): bool
    {
        return $request->is('api/*', 'sanctum/*') || $request->expectsJson();
    }

    /**
     * @return array{0: int, 1: string, 2: string, 3: list<array<string, string>>, 4: array<string, string>}
     */
    private static function map(Throwable $e, string $traceId): array
    {
        return match (true) {
            $e instanceof ValidationException => [
                422, 'VALIDATION_ERROR', __('errors.validation'), self::fieldDetails($e), [],
            ],
            $e instanceof BusinessRuleException => [
                409, $e->errorCode, $e->getMessage(), $e->details, [],
            ],
            $e instanceof UnprocessableRuleException => [
                422, $e->errorCode, $e->getMessage(), $e->details, [],
            ],
            $e instanceof TooManyAttemptsException => [
                429, 'TOO_MANY_REQUESTS', $e->getMessage(), [], ['Retry-After' => (string) $e->retryAfter],
            ],
            $e instanceof AuthenticationException => [
                401, 'UNAUTHENTICATED', __('errors.unauthenticated'), [], [],
            ],
            $e instanceof AuthorizationException => self::fromAuthorization($e),
            $e instanceof ModelNotFoundException => [
                404, 'NOT_FOUND', __('errors.not_found'), [], [],
            ],
            $e instanceof TokenMismatchException => [
                419, 'CSRF_TOKEN_MISMATCH', __('errors.csrf'), [], [],
            ],
            $e instanceof HttpExceptionInterface => self::fromHttp($e, $traceId),
            self::isDatabaseUnavailable($e) => [
                503, 'SERVICE_UNAVAILABLE', __('errors.service_unavailable'), [], [],
            ],
            default => [
                500, 'INTERNAL_ERROR', __('errors.internal', ['trace_id' => $traceId]), [], [],
            ],
        };
    }

    /**
     * @return array{0: int, 1: string, 2: string, 3: list<array<string, string>>, 4: array<string, string>}
     */
    private static function fromAuthorization(AuthorizationException $e): array
    {
        // `denyAsNotFound()` esconde a existência do recurso fora do escopo do usuário (BR-007, BR-030)
        return $e->status() === 404
            ? [404, 'NOT_FOUND', __('errors.not_found'), [], []]
            : [403, 'FORBIDDEN', __('errors.forbidden'), [], []];
    }

    /**
     * @return array{0: int, 1: string, 2: string, 3: list<array<string, string>>, 4: array<string, string>}
     */
    private static function fromHttp(HttpExceptionInterface $e, string $traceId): array
    {
        $status = $e->getStatusCode();
        /** @var array<string, string> $headers */
        $headers = array_map('strval', $e->getHeaders());

        return match (true) {
            $status === 401 => [401, 'UNAUTHENTICATED', __('errors.unauthenticated'), [], $headers],
            $status === 403 => [403, 'FORBIDDEN', __('errors.forbidden'), [], $headers],
            $status === 404 => [404, 'NOT_FOUND', __('errors.not_found'), [], $headers],
            $status === 405 => [405, 'METHOD_NOT_ALLOWED', __('errors.method_not_allowed'), [], $headers],
            // O upload informa o limite do campo na mensagem (BR-041, BR-045); o limite do servidor vem sem texto
            $status === 413 => [
                413, 'PAYLOAD_TOO_LARGE', $e->getMessage() !== '' ? $e->getMessage() : __('errors.payload_too_large'), [], $headers,
            ],
            $status === 419 => [419, 'CSRF_TOKEN_MISMATCH', __('errors.csrf'), [], $headers],
            $status === 429 => [429, 'TOO_MANY_REQUESTS', __('errors.too_many_requests'), [], $headers],
            $status === 503 => [503, 'SERVICE_UNAVAILABLE', __('errors.service_unavailable'), [], $headers],
            $status >= 500 => [500, 'INTERNAL_ERROR', __('errors.internal', ['trace_id' => $traceId]), [], []],
            default => [$status, 'HTTP_ERROR', __('errors.conflict'), [], $headers],
        };
    }

    /**
     * Um item por campo e regra violada. O `code` é o nome da regra em snake_case (`required`, `invalid_phone`…),
     * que a SPA mapeia para o campo do formulário.
     *
     * @return list<array<string, string>>
     */
    private static function fieldDetails(ValidationException $e): array
    {
        $failed = $e->validator->failed();
        $details = [];

        foreach ($e->errors() as $field => $messages) {
            $rules = array_keys($failed[$field] ?? []);
            foreach (array_values($messages) as $index => $message) {
                $details[] = [
                    'field' => (string) $field,
                    'code' => isset($rules[$index]) ? self::snake((string) $rules[$index]) : 'invalid',
                    'message' => $message,
                ];
            }
        }

        return $details;
    }

    private static function snake(string $rule): string
    {
        // Regra de objeto (`Rule::enum()`): o Laravel a informa pelo nome completo da classe; vale só o nome curto
        $rule = str_contains($rule, '\\') ? substr((string) strrchr($rule, '\\'), 1) : $rule;

        return strtolower((string) preg_replace('/(?<!^)[A-Z]/', '_$0', $rule));
    }

    /** Banco fora do ar ou sem conexões livres (limite do plano compartilhado): 503, não 500. */
    private static function isDatabaseUnavailable(Throwable $e): bool
    {
        if ($e instanceof LostConnectionException) {
            return true;
        }

        if (! $e instanceof QueryException) {
            return false;
        }

        $previous = $e->getPrevious();
        $driverCode = $previous instanceof PDOException ? ($previous->errorInfo[1] ?? null) : null;

        // 2002/2003 sem conexão · 2006/2013 conexão perdida · 1040 too many connections · 1226 max_user_connections
        return in_array($driverCode, [2002, 2003, 2006, 2013, 1040, 1226], true);
    }
}
