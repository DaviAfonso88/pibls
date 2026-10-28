<?php

declare(strict_types=1);

use App\Shared\Http\BusinessRuleException;
use App\Shared\Logging\SentryScrubber;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Sentry (UE), plano gratuito. Observability → Error tracking; ADR-012; integração I-06.
 *
 * Sem `SENTRY_LARAVEL_DSN` o SDK fica desligado (local e CI). Nada de dado pessoal: `send_default_pii` é falso,
 * o usuário vai só pelo id, e o `before_send` mascara o que sobrar (SentryScrubber).
 */
return [

    'dsn' => env('SENTRY_LARAVEL_DSN') ?: null,

    'release' => env('APP_RELEASE', 'dev'),

    'environment' => env('SENTRY_ENVIRONMENT', env('APP_ENV', 'production')),

    'sample_rate' => 1.0,

    // Sem tracing de desempenho nem profiling: o plano gratuito é só para erros
    'traces_sample_rate' => null,

    'send_default_pii' => false,

    'before_send' => [SentryScrubber::class, 'beforeSend'],

    // Erros 4xx esperados (validação, 404, 409, 401/403, 419, 429) não vão ao Sentry
    'ignore_exceptions' => [
        ValidationException::class,
        BusinessRuleException::class,
        AuthenticationException::class,
        AuthorizationException::class,
        ModelNotFoundException::class,
        TokenMismatchException::class,
        ThrottleRequestsException::class,
        PostTooLargeException::class,
        NotFoundHttpException::class,
        MethodNotAllowedHttpException::class,
        AccessDeniedHttpException::class,
    ],

    'ignore_transactions' => ['/up', '/api/health'],

    // Sem conteúdo de formulário nem bindings de SQL nos breadcrumbs
    'breadcrumbs' => [
        'logs' => false,
        'cache' => false,
        'livewire' => false,
        'sql_queries' => false,
        'sql_bindings' => false,
        'queue_info' => true,
        'command_info' => true,
        'http_client_requests' => false,
        'notifications' => false,
    ],

    'tracing' => [
        'queue_job_transactions' => false,
        'queue_jobs' => false,
        'sql_queries' => false,
        'sql_bindings' => false,
        'sql_origin' => false,
        'views' => false,
        'livewire' => false,
        'http_client_requests' => false,
        'cache' => false,
        'redis_commands' => false,
        'notifications' => false,
        'missing_routes' => false,
        'default_integrations' => false,
    ],

];
