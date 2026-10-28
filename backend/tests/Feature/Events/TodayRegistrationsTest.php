<?php

declare(strict_types=1);

use App\Modules\Events\Http\Resources\TodayRegistrationResource;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Support\Carbon;

use function Pest\Laravel\getJson;

/*
| Inscrições de hoje no Início do painel: GET /api/admin/registrations/today (CAP-15, FR-060; BR-030, BR-075, BR-076),
| com a flag FEATURE_EVENTS ligada. O "hoje" é o dia de Brasília.
*/

beforeEach(function () {
    config(['features.events' => true]);
    // 14h de Brasília de 10/11/2026
    Carbon::setTestNow('2026-11-10 17:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/** @param  array<string, mixed>  $overrides */
function todayRegistration(Event $event, string $name, string $createdAt, array $overrides = []): EventRegistration
{
    return EventRegistration::factory()->create([
        'event_id' => $event->getKey(),
        'participant_name' => $name,
        'created_at' => $createdAt,
        ...$overrides,
    ]);
}

it('com FEATURE_EVENTS desligada a rota responde 404', function () {
    config(['features.events' => false]);
    asStaff('COMUNICACAO');

    getJson('/api/admin/registrations/today')->assertNotFound();
});

it('BR-076 sem sessão responde 401', function () {
    getJson('/api/admin/registrations/today')->assertUnauthorized();
});

it('BR-076 quem não lê inscritos recebe 403', function (string $role) {
    asStaff($role);

    getJson('/api/admin/registrations/today')->assertForbidden();
})->with(['TESOURARIA', 'ORACAO', 'PASTORAL', 'ADMIN_TECNICO']);

it('lista só as inscrições de hoje, da mais nova para a mais antiga, com nome abreviado e o evento', function () {
    asStaff('COMUNICACAO');
    $event = Event::factory()->published()->create(['title' => 'Retiro de jovens']);
    // 10/11 em Brasília vai de 03:00Z de 10/11 até 02:59Z de 11/11
    todayRegistration($event, 'Ontem Tarde', '2026-11-10 02:59:59');
    todayRegistration($event, 'Pedro Henrique Alves', '2026-11-10 12:30:00');
    todayRegistration($event, 'Marta', '2026-11-10 16:45:00');
    todayRegistration($event, 'Amanhã Cedo', '2026-11-11 03:00:00');

    $response = getJson('/api/admin/registrations/today')->assertOk();

    $response->assertJsonPath('meta.total', 2)
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.name', 'Marta')
        ->assertJsonPath('data.0.created_at', '2026-11-10T16:45:00Z')
        ->assertJsonPath('data.0.event.title', 'Retiro de jovens')
        ->assertJsonPath('data.1.name', 'Pedro A.');
    expect(array_keys($response->json('data.0')))->toBe(['id', 'created_at', 'name', 'event'])
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('não devolve telefone, e-mail nem o nome completo', function () {
    asStaff('COMUNICACAO');
    todayRegistration(Event::factory()->published()->create(), 'Pedro Henrique Alves', '2026-11-10 12:00:00', [
        'phone' => '+5531988776655',
        'email' => 'pedro@example.com',
    ]);

    $body = getJson('/api/admin/registrations/today')->assertOk()->getContent();

    expect($body)->not->toContain('5531988776655')
        ->and($body)->not->toContain('pedro@example.com')
        ->and($body)->not->toContain('Henrique');
});

it('mostra no máximo 10 linhas, mas o total conta todas do dia', function () {
    asStaff('COMUNICACAO');
    $event = Event::factory()->published()->create();
    foreach (range(1, 12) as $minute) {
        todayRegistration($event, "Pessoa {$minute}", Carbon::parse('2026-11-10 12:00:00')->addMinutes($minute)->toDateTimeString());
    }

    getJson('/api/admin/registrations/today')->assertOk()
        ->assertJsonCount(10, 'data')
        ->assertJsonPath('meta.total', 12);
});

it('sem inscrições hoje, devolve lista vazia e total zero', function () {
    asStaff('COMUNICACAO');

    getJson('/api/admin/registrations/today')->assertOk()
        ->assertExactJson(['data' => [], 'meta' => ['total' => 0]]);
});

it('BR-030 o líder (.own) só vê as inscrições de hoje dos eventos do próprio ministério', function () {
    $leader = asStaff('LIDER_MINISTERIO');
    $own = Event::factory()->published()->create(['ministry_id' => $leader->ministry_id, 'title' => 'Do meu ministério']);
    $foreign = Event::factory()->published()->create(['title' => 'De outro ministério']);
    todayRegistration($own, 'Ana Souza', '2026-11-10 12:00:00');
    todayRegistration($foreign, 'Bruno Lima', '2026-11-10 13:00:00');

    getJson('/api/admin/registrations/today')->assertOk()
        ->assertJsonPath('meta.total', 1)
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.event.title', 'Do meu ministério');
});

it('BR-075 o líder sem ministério vinculado recebe 403', function () {
    asStaff('LIDER_MINISTERIO', ['ministry_id' => null]);

    getJson('/api/admin/registrations/today')->assertForbidden();
});

it('abrevia o nome: primeiro nome e inicial do último sobrenome', function (string $name, string $expected) {
    expect(TodayRegistrationResource::abbreviate($name))->toBe($expected);
})->with([
    ['Pedro Henrique Alves', 'Pedro A.'],
    ['  maria   souza ', 'maria S.'],
    ['Marta', 'Marta'],
    ['Érica Ávila', 'Érica Á.'],
    ['', ''],
]);
