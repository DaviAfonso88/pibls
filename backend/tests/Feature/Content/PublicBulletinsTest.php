<?php

declare(strict_types=1);

use App\Modules\Content\Models\Bulletin;

use function Pest\Laravel\getJson;

/*
| GET /api/public/bulletins (T108; contracts/openapi.yaml): 12 por página, reference_date decrescente, filtro de mês e
| ano, 422 para parâmetro inválido. BR-042: agendado e excluído não aparecem.
*/

it('responde 200 com {data, meta}, o formato BulletinPublic e cache público de 60 s', function () {
    Bulletin::factory()->create([
        'edition_number' => 1234,
        'reference_date' => '2026-11-08',
        'title' => 'Boletim 1234',
        'summary_text' => 'Resumo.',
        'pdf_path' => 'boletins/2026/3f9c1b2a3f9c1b2a3f9c1b2a3f9c1b2a.pdf',
        'pdf_size_bytes' => 1843200,
    ]);

    getJson('/api/public/bulletins')
        ->assertOk()
        ->assertHeader('Cache-Control', 'max-age=60, public')
        ->assertExactJson([
            'data' => [[
                'id' => Bulletin::query()->firstOrFail()->getKey(),
                'edition_number' => 1234,
                'reference_date' => '2026-11-08',
                'title' => 'Boletim 1234',
                'summary_text' => 'Resumo.',
                'pdf_url' => '/uploads/boletins/2026/3f9c1b2a3f9c1b2a3f9c1b2a3f9c1b2a.pdf',
                'pdf_size_bytes' => 1843200,
            ]],
            'meta' => ['page' => 1, 'per_page' => 12, 'total' => 1, 'last_page' => 1],
        ]);
});

it('pagina de 12 em 12', function () {
    Bulletin::factory()->count(27)->create(['published_at' => now()->subDay()]);

    getJson('/api/public/bulletins')->assertOk()->assertJsonCount(12, 'data')
        ->assertJsonPath('meta', ['page' => 1, 'per_page' => 12, 'total' => 27, 'last_page' => 3]);
    getJson('/api/public/bulletins?page=3')->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.page', 3);
});

it('ordena por reference_date decrescente e desempata pela edição', function () {
    Bulletin::factory()->create(['edition_number' => 5, 'reference_date' => '2026-01-04', 'published_at' => now()->subDay()]);
    Bulletin::factory()->create(['edition_number' => 7, 'reference_date' => '2026-03-01', 'published_at' => now()->subDay()]);
    Bulletin::factory()->create(['edition_number' => 6, 'reference_date' => '2026-03-01', 'published_at' => now()->subDay()]);

    expect(getJson('/api/public/bulletins')->assertOk()->json('data.*.edition_number'))->toBe([7, 6, 5]);
});

it('filtra por ano e por mês dentro do ano', function () {
    Bulletin::factory()->create(['edition_number' => 1, 'reference_date' => '2025-12-28', 'published_at' => now()->subYear()]);
    Bulletin::factory()->create(['edition_number' => 2, 'reference_date' => '2026-01-04', 'published_at' => now()->subDay()]);
    Bulletin::factory()->create(['edition_number' => 3, 'reference_date' => '2026-03-01', 'published_at' => now()->subDay()]);
    Bulletin::factory()->create(['edition_number' => 4, 'reference_date' => '2026-03-29', 'published_at' => now()->subDay()]);

    expect(getJson('/api/public/bulletins?year=2026')->json('data.*.edition_number'))->toBe([4, 3, 2])
        ->and(getJson('/api/public/bulletins?year=2026&month=3')->json('data.*.edition_number'))->toBe([4, 3])
        ->and(getJson('/api/public/bulletins?year=2025&month=12')->json('data.*.edition_number'))->toBe([1])
        ->and(getJson('/api/public/bulletins?year=2024')->json('data'))->toBe([]);
});

it('responde 422 para mês sem ano e para ano, mês ou página inválidos', function (string $query, string $field) {
    getJson("/api/public/bulletins?{$query}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonFragment(['field' => $field]);
})->with([
    'mês sem ano' => ['month=3', 'year'],
    'mês zero' => ['year=2026&month=0', 'month'],
    'mês 13' => ['year=2026&month=13', 'month'],
    'ano antes da fundação' => ['year=1984', 'year'],
    'ano distante' => ['year=2101', 'year'],
    'ano em texto' => ['year=abc', 'year'],
    'página zero' => ['page=0', 'page'],
]);

it('BR-042 não mostra o boletim agendado nem o excluído', function () {
    Bulletin::factory()->create(['edition_number' => 1, 'published_at' => now()->subDay()]);
    Bulletin::factory()->scheduled()->create(['edition_number' => 2]);
    Bulletin::factory()->trashed()->create(['edition_number' => 3, 'published_at' => now()->subDay()]);

    $body = getJson('/api/public/bulletins')->assertOk();

    expect($body->json('data.*.edition_number'))->toBe([1])
        ->and($body->json('meta.total'))->toBe(1);
});

it('BR-042 um boletim agendado passa a aparecer quando o horário chega', function () {
    $bulletin = Bulletin::factory()->create(['edition_number' => 9, 'published_at' => now()->addHour()]);

    getJson('/api/public/bulletins')->assertOk()->assertJsonCount(0, 'data');

    $this->travel(2)->hours();

    getJson('/api/public/bulletins')->assertOk()->assertJsonPath('data.0.id', $bulletin->getKey());
});

it('não expõe campos do painel nem o caminho interno do arquivo', function () {
    Bulletin::factory()->create(['published_at' => now()->subDay()]);

    $item = getJson('/api/public/bulletins')->assertOk()->json('data.0');

    expect(array_keys($item))->toBe(['id', 'edition_number', 'reference_date', 'title', 'summary_text', 'pdf_url', 'pdf_size_bytes'])
        ->and($item['pdf_url'])->toStartWith('/uploads/boletins/');
});
