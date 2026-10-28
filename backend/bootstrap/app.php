<?php

use App\Modules\Access\Http\Middleware\EnforceSessionLimits;
use App\Modules\Access\Http\Middleware\EnsureUserIsActive;
use App\Poc\Console\SetupCommand;
use App\Shared\Http\AccessLog;
use App\Shared\Http\BusinessRuleException;
use App\Shared\Http\DiscardHoneypot;
use App\Shared\Http\EnsureFeatureEnabled;
use App\Shared\Http\ErrorRenderer;
use App\Shared\Http\RequestId;
use App\Shared\Http\TooManyAttemptsException;
use App\Shared\Http\UnprocessableRuleException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Sentry\Laravel\Integration;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // PoC F0-03 (T013): REMOVER este gancho na T015, junto com routes/poc.php e app/Poc/.
        then: function () {
            Route::middleware('api')->prefix('api')->group(base_path('routes/poc.php'));
        },
    )
    // PoC F0-03 (T013): REMOVER na T015.
    ->withCommands([SetupCommand::class, ...glob(dirname(__DIR__).'/app/Modules/*/Console', GLOB_ONLYDIR) ?: []])
    ->withMiddleware(function (Middleware $middleware): void {
        // O correlation ID nasce antes de qualquer outro middleware, para que até o erro mais cedo o carregue.
        $middleware->prepend(RequestId::class);
        $middleware->append(AccessLog::class);

        // A API nunca redireciona para uma tela de login: quem não tem sessão recebe 401 com o envelope de erro, mesmo sem
        // `Accept: application/json` (o Authenticate chamaria `route('login')`, que não existe, e daria 500).
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'feature' => EnsureFeatureEnabled::class,
            'honeypot' => DiscardHoneypot::class,
            'session.limits' => EnforceSessionLimits::class,
            'active.user' => EnsureUserIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        Integration::handles($exceptions);

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => ErrorRenderer::wantsEnvelope($request),
        );
        $exceptions->render(
            fn (Throwable $e, Request $request) => ErrorRenderer::render($e, $request),
        );

        // Regra de negócio violada é resposta esperada (409, 422 com código próprio, 429 de bloqueio), não defeito.
        $exceptions->dontReport([
            BusinessRuleException::class,
            UnprocessableRuleException::class,
            TooManyAttemptsException::class,
        ]);
    })->create();

// Hospedagem (architecture.md → Layout de diretórios): a release é imutável, então o `.env` e o `storage/` ficam em
// `private/<app>/shared/`, fora dela. O front controller, o wrapper do artisan e o ativador informam o caminho em
// PIBLS_SHARED_PATH. Local e CI não definem a variável e seguem o padrão do Laravel.
$shared = $_SERVER['PIBLS_SHARED_PATH'] ?? $_ENV['PIBLS_SHARED_PATH'] ?? getenv('PIBLS_SHARED_PATH');
if (is_string($shared) && $shared !== '') {
    $app->useEnvironmentPath($shared)->useStoragePath($shared.'/storage');
}

return $app;
