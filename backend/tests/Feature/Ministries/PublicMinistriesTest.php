<?php

declare(strict_types=1);

use App\Modules\Ministries\Models\MinistryGroup;

use function Pest\Laravel\getJson;

/*
| GET /api/public/ministries (contracts/openapi.yaml → MinistryPublic). O seed já traz ministérios e grupos;
| cada teste começa de um catálogo vazio para saber exatamente o que deve aparecer.
*/

beforeEach(function () {
    MinistryGroup::query()->delete();
});

it('BR-048 nunca expõe private_address nem contact_email', function () {
    MinistryGroup::factory()->cell()->create([
        'name' => 'Célula de CL Promissão',
        'private_address' => 'Rua Secreta, 77',
        'contact_email' => 'celula@example.com',
    ]);

    $response = getJson('/api/public/ministries')->assertOk();

    expect($response->getContent())
        ->not->toContain('private_address')->not->toContain('Rua Secreta')
        ->not->toContain('contact_email')->not->toContain('celula@example.com');
    expect(array_keys($response->json('data.0')))->toEqualCanonicalizing([
        'id', 'category', 'name', 'description', 'leaders_text', 'schedule_text', 'neighborhood', 'contact_phone',
    ]);
});

it('lista só os ativos, por ordem de exibição e depois por nome', function () {
    MinistryGroup::factory()->create(['name' => 'Zeta', 'display_order' => 1]);
    MinistryGroup::factory()->create(['name' => 'Beta', 'display_order' => 2]);
    MinistryGroup::factory()->create(['name' => 'Alfa', 'display_order' => 2]);
    MinistryGroup::factory()->inactive()->create(['name' => 'Desativado', 'display_order' => 0]);

    getJson('/api/public/ministries')->assertOk()
        ->assertJsonCount(3, 'data')
        ->assertJson(['data' => [['name' => 'Zeta'], ['name' => 'Alfa'], ['name' => 'Beta']]]);
});

it('filtra por categoria', function () {
    MinistryGroup::factory()->create(['name' => 'Música']);
    MinistryGroup::factory()->group()->create(['name' => 'Homens']);
    MinistryGroup::factory()->cell()->create(['name' => 'Célula Centro']);

    getJson('/api/public/ministries?category=GRUPO')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Homens');
});

it('filtra as células por bairro, sem diferenciar maiúsculas', function () {
    MinistryGroup::factory()->cell()->create(['name' => 'Célula A', 'neighborhood' => 'Promissão']);
    MinistryGroup::factory()->cell()->create(['name' => 'Célula B', 'neighborhood' => 'Centro']);

    getJson('/api/public/ministries?category=CELULA&neighborhood=promissão')->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'Célula A');
});

it('responde 422 no envelope para categoria inválida, com o campo no details', function () {
    getJson('/api/public/ministries?category=OUTRA')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'category')
        ->assertJsonPath('error.details.0.code', 'enum');
});

it('responde 422 para bairro com mais de 80 caracteres', function () {
    getJson('/api/public/ministries?neighborhood='.str_repeat('a', 81))
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'neighborhood');
});

it('devolve lista vazia, e não erro, quando não há nada', function () {
    getJson('/api/public/ministries')->assertOk()->assertExactJson(['data' => []]);
});

it('usa cache público curto, como as demais leituras públicas', function () {
    getJson('/api/public/ministries')->assertOk()->assertHeader('Cache-Control', 'max-age=60, public');
});
