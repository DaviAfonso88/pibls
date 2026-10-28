<?php

declare(strict_types=1);

use App\Modules\Platform\Actions\CheckHealth;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

it('responde 200 com a release ativa quando o banco responde', function () {
    config(['pibls.release' => '2026.11.3']);

    getJson('/api/health')->assertOk()
        ->assertExactJson(['status' => 'ok', 'release' => '2026.11.3'])
        ->assertHeader('Cache-Control', 'no-store, private');
});

it('responde 503 sem nenhum detalhe interno quando o banco não responde', function () {
    $this->app->bind(CheckHealth::class, fn () => new class extends CheckHealth
    {
        public function __invoke(): bool
        {
            return false;
        }
    });

    $response = getJson('/api/health');

    $response->assertStatus(503)->assertExactJson(['status' => 'degraded']);
    expect($response->getContent())->not->toContain('release')->not->toContain('SQLSTATE');
});

it('responde 503 de verdade quando a conexão com o banco falha', function () {
    // Uma segunda conexão apontando para uma porta fechada; a conexão dos testes (e a transação deles) fica intacta
    config([
        'database.connections.quebrada' => [...config('database.connections.mysql'), 'host' => '127.0.0.1', 'port' => '1'],
        'database.default' => 'quebrada',
    ]);

    try {
        getJson('/api/health')->assertStatus(503)->assertExactJson(['status' => 'degraded']);
    } finally {
        // A limpeza do RefreshDatabase usa a conexão padrão: devolve a dos testes antes dela rodar
        config(['database.default' => 'mysql']);
    }
});

it('não aceita escrita', function () {
    postJson('/api/health')->assertStatus(405);
});

it('tem o rate limit public-read', function () {
    $route = app('router')->getRoutes()->getByName('health');

    expect($route)->not->toBeNull()
        ->and($route->gatherMiddleware())->toContain('throttle:public-read');
});
