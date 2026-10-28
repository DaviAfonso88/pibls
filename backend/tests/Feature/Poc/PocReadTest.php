<?php

declare(strict_types=1);

use App\Poc\PocData;

use function Pest\Laravel\getJson;

// PoC F0-03 (T013). REMOVER na T015.

it('PoC lê grupos ativos com join na categoria, em ordem, limitado a 50', function () {
    PocData::seed(120);

    $response = getJson('/api/poc/read')->assertOk();

    $data = $response->json('data');
    expect($data)->toHaveCount(50)
        ->and($data[0])->toHaveKeys(['id', 'name', 'neighborhood', 'category'])
        ->and($data[0]['category'])->toBe('ministerio')
        // só ativos: o seed marca como inativo todo grupo de índice múltiplo de 10
        ->and(array_column($data, 'name'))->not->toContain('Grupo 10');
});

it('PoC responde com lista vazia quando não há grupos', function () {
    PocData::seed(0);

    getJson('/api/poc/read')->assertOk()->assertExactJson(['data' => []]);
});
