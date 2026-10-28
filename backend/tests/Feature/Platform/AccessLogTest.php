<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;

/*
| Observability → Logging: uma linha `info` por requisição (`warning` acima de 2 s), sem corpo, query string nem IP.
*/

it('registra uma linha info por requisição com rota, status e duração', function () {
    Log::spy();

    getJson('/api/health?telefone=31999998888&email=ana@exemplo.com')->assertOk();

    Log::shouldHaveReceived('log')->withArgs(function (string $level, string $message, array $context) {
        // `warning` só se a máquina de teste estiver tão carregada que a requisição passe de 2 s (há teste próprio para isso)
        return in_array($level, ['info', 'warning'], true)
            && $message === 'http.request'
            && $context['action'] === 'health'
            && $context['httpStatus'] === 200
            && is_int($context['durationMs'])
            && $context['userId'] === null
            && ! str_contains(json_encode($context, JSON_THROW_ON_ERROR), '31999998888')
            && ! str_contains(json_encode($context, JSON_THROW_ON_ERROR), 'ana@exemplo.com')
            && ! str_contains(json_encode($context, JSON_THROW_ON_ERROR), '127.0.0.1');
    })->once();
});

it('registra o id do usuário autenticado', function () {
    Route::middleware(['api', 'auth:web'])->get('/api/_quem', fn () => response()->json([]))->name('quem');
    $user = User::factory()->create();
    actingAs($user);
    Log::spy();

    getJson('/api/_quem')->assertOk();

    Log::shouldHaveReceived('log')->withArgs(
        fn (string $level, string $message, array $context) => $message === 'http.request'
            && $context['action'] === 'quem'
            && $context['userId'] === $user->getKey(),
    )->once();
});

it('usa o método e o padrão da rota quando ela não tem nome', function () {
    Route::middleware('api')->get('/api/_itens/{id}', fn () => response()->json([]));
    Log::spy();

    getJson('/api/_itens/42')->assertOk();

    Log::shouldHaveReceived('log')->withArgs(
        fn (string $level, string $message, array $context) => $message === 'http.request'
            && $context['action'] === 'GET /api/_itens/{id}',
    )->once();
});

it('registra warning quando a requisição passa de 2 segundos', function () {
    Route::middleware('api')->get('/api/_lenta', function () {
        usleep(2_100_000);

        return response()->json([]);
    })->name('lenta');
    Log::spy();

    getJson('/api/_lenta')->assertOk();

    Log::shouldHaveReceived('log')->withArgs(
        fn (string $level, string $message, array $context) => $level === 'warning'
            && $message === 'http.request'
            && $context['action'] === 'lenta'
            && $context['durationMs'] > 2000,
    )->once();
});
