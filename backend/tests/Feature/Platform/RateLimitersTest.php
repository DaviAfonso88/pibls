<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Shared\Http\RateLimiters;
use Illuminate\Cache\RateLimiter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter as RateLimiterFacade;
use Illuminate\Support\Facades\Route;

use function Pest\Laravel\actingAs;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/*
| API Standards → Limites por rota. As rotas abaixo existem só nestes testes, uma por limiter nomeado.
*/

beforeEach(function () {
    Route::middleware(['api', 'throttle:lead-submit'])->post('/api/_lead', fn () => response()->json([], 201));
    Route::middleware(['api', 'throttle:registration-submit'])->post('/api/_inscricao', fn () => response()->json([], 201));
    Route::middleware(['api', 'throttle:password-forgot'])->post('/api/_esqueci', fn () => response()->json([], 202));
    Route::middleware(['api', 'throttle:password-reset'])->post('/api/_redefinir', fn () => response()->json([], 200));
    Route::middleware(['api', 'throttle:login'])->post('/api/_login', fn () => response()->json([], 200));
    Route::middleware(['api', 'throttle:public-read'])->get('/api/_leitura', fn () => response()->json([], 200));
    Route::middleware(['api', 'throttle:admin'])->get('/api/_painel', fn () => response()->json([], 200));
    Route::middleware(['api', 'throttle:admin-export'])->get('/api/_exportar', fn () => response()->json([], 200));
});

it('BR-003 recusa o 4º envio do mesmo telefone em 10 minutos', function () {
    foreach (range(1, 3) as $i) {
        postJson('/api/_lead', ['phone' => '(31) 99999-8888'])->assertCreated();
    }

    $response = postJson('/api/_lead', ['phone' => '(31) 99999-8888']);

    $response->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS')
        ->assertHeader('X-RateLimit-Limit', '3')
        ->assertHeader('X-RateLimit-Remaining', '0');
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0);
});

it('BR-003 trata o mesmo telefone com máscaras e DDI diferentes como a mesma pessoa', function () {
    postJson('/api/_lead', ['phone' => '(31) 99999-8888'])->assertCreated();
    postJson('/api/_lead', ['phone' => '31999998888'])->assertCreated();
    postJson('/api/_lead', ['phone' => '31 99999 8888'])->assertCreated();

    postJson('/api/_lead', ['phone' => '+55 31 99999-8888'])->assertStatus(429);
});

it('BR-003 não deixa o limite de um telefone afetar outro', function () {
    foreach (range(1, 3) as $i) {
        postJson('/api/_lead', ['phone' => '31999990001'])->assertCreated();
    }

    postJson('/api/_lead', ['phone' => '31999990001'])->assertStatus(429);
    postJson('/api/_lead', ['phone' => '31999990002'])->assertCreated();
});

it('BR-003 limita por e-mail sem diferenciar maiúsculas', function () {
    postJson('/api/_lead', ['email' => 'Ana@Exemplo.com'])->assertCreated();
    postJson('/api/_lead', ['email' => 'ana@exemplo.com'])->assertCreated();
    postJson('/api/_lead', ['email' => ' ANA@exemplo.com '])->assertCreated();

    postJson('/api/_lead', ['email' => 'ana@exemplo.com'])->assertStatus(429);
});

it('BR-003 limita a 10 envios por IP em 10 minutos, mesmo com contatos diferentes', function () {
    foreach (range(1, 10) as $i) {
        postJson('/api/_lead', ['phone' => '3199999'.str_pad((string) $i, 4, '0', STR_PAD_LEFT)])->assertCreated();
    }

    postJson('/api/_lead', ['phone' => '31988880000'])->assertStatus(429);
});

it('limita as inscrições a 5 por telefone em 10 minutos', function () {
    foreach (range(1, 5) as $i) {
        postJson('/api/_inscricao', ['phone' => '31977770000'])->assertCreated();
    }

    postJson('/api/_inscricao', ['phone' => '31977770000'])->assertStatus(429);
    postJson('/api/_inscricao', ['phone' => '31977771111'])->assertCreated();
});

it('limita o pedido de nova senha a 3 por hora por e-mail', function () {
    foreach (range(1, 3) as $i) {
        postJson('/api/_esqueci', ['email' => 'pastor@pibls.test'])->assertStatus(202);
    }

    postJson('/api/_esqueci', ['email' => 'pastor@pibls.test'])->assertStatus(429);
    postJson('/api/_esqueci', ['email' => 'outro@pibls.test'])->assertStatus(202);
});

it('limita a redefinição de senha a 10 por hora por IP', function () {
    foreach (range(1, 10) as $i) {
        postJson('/api/_redefinir')->assertOk();
    }

    postJson('/api/_redefinir')->assertStatus(429);
});

it('limita o login a 20 tentativas por IP em 15 minutos', function () {
    foreach (range(1, 20) as $i) {
        postJson('/api/_login')->assertOk();
    }

    postJson('/api/_login')->assertStatus(429);
});

it('limita a leitura pública a 300 requisições por minuto por IP', function () {
    foreach (range(1, 300) as $i) {
        getJson('/api/_leitura')->assertOk();
    }

    getJson('/api/_leitura')->assertStatus(429);
});

it('limita o painel a 120 requisições por minuto por usuário', function () {
    $ana = User::factory()->create();
    $beto = User::factory()->create();

    actingAs($ana);
    foreach (range(1, 120) as $i) {
        getJson('/api/_painel')->assertOk();
    }
    getJson('/api/_painel')->assertStatus(429);

    actingAs($beto);
    getJson('/api/_painel')->assertOk();
});

it('limita as exportações a 10 por 10 minutos por usuário', function () {
    actingAs(User::factory()->create());

    foreach (range(1, 10) as $i) {
        getJson('/api/_exportar')->assertOk();
    }

    getJson('/api/_exportar')->assertStatus(429);
});

it('guarda só hashes no store database, nunca IP, telefone ou e-mail', function () {
    config(['cache.limiter' => 'database']);
    // Refaz o RateLimiter sobre o store trocado (o facade também guarda a instância antiga)...
    app()->forgetInstance(RateLimiter::class);
    RateLimiterFacade::clearResolvedInstance(RateLimiter::class);
    // ...e declara os limiters nomeados de novo nele.
    RateLimiters::register();

    postJson('/api/_lead', ['phone' => '(31) 99999-8888', 'email' => 'ana@exemplo.com'])->assertCreated();

    $keys = DB::table('cache')->pluck('key')->implode(' ');
    expect($keys)->not->toBe('')
        ->and($keys)->not->toContain('31999998888')
        ->and($keys)->not->toContain('ana@exemplo.com')
        ->and($keys)->not->toContain('127.0.0.1');
});

it('registra um warning com o hash do IP, nunca o IP, ao estourar o limite', function () {
    Log::spy();

    foreach (range(1, 4) as $i) {
        postJson('/api/_lead', ['phone' => '31999995555']);
    }

    Log::shouldHaveReceived('warning')->withArgs(function (string $message, array $context) {
        return $message === 'rate_limit.hit'
            && $context['limiter'] === 'lead-submit'
            && $context['ipHash'] === RateLimiters::hash('127.0.0.1')
            && ! in_array('127.0.0.1', $context, true);
    })->atLeast()->once();
});
