<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;

use function Pest\Laravel\get;

it('responde 200 na rota inicial', function () {
    get('/')->assertOk();
});

it('responde 200 no health check padrão do Laravel', function () {
    get('/up')->assertOk();
});

it('roda os feature tests no MySQL real, não em SQLite nem em memória', function () {
    expect(DB::connection()->getDriverName())->toBe('mysql')
        ->and(DB::connection()->getDatabaseName())->toBe('pibls_test');
});
