<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;

use function Pest\Laravel\getJson;

/*
| DevOps → Feature flags: `FEATURE_EVENTS` desligada faz as rotas de eventos responderem 404.
*/

beforeEach(function () {
    Route::middleware(['api', 'feature:events'])->get('/api/_eventos', fn () => response()->json(['data' => []]));
});

it('responde 404 no envelope quando a flag está desligada', function () {
    config(['features.events' => false]);

    getJson('/api/_eventos')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
});

it('deixa a rota passar quando a flag está ligada', function () {
    config(['features.events' => true]);

    getJson('/api/_eventos')->assertOk()->assertExactJson(['data' => []]);
});

it('trata flag inexistente como desligada', function () {
    Route::middleware(['api', 'feature:nao-existe'])->get('/api/_outra', fn () => 'ok');

    getJson('/api/_outra')->assertNotFound();
});

it('desliga os eventos por padrão (R1 sai com FEATURE_EVENTS=false)', function () {
    expect(config('features.events'))->toBeFalse();
});
