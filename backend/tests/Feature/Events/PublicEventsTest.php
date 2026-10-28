<?php

declare(strict_types=1);

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Support\Carbon;

use function Pest\Laravel\getJson;

/*
| Leitura pública dos eventos (T186): GET /api/public/events e /api/public/events/{slug} (contracts/openapi.yaml →
| EventSummary, EventPublicDetail). R2: com FEATURE_EVENTS desligada respondem 404. BR-048 e BR-050 (nada privado).
*/

beforeEach(function () {
    config(['features.events' => true]);
    Carbon::setTestNow('2026-11-10 12:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/** @param  array<string, mixed>  $overrides */
function listedEvent(string $slug, string $startsAt, array $overrides = []): Event
{
    return Event::factory()->published()->create(['slug' => $slug, 'title' => "Evento {$slug}", 'starts_at' => $startsAt, ...$overrides]);
}

it('lista só os publicados e ainda por acontecer, do mais perto ao mais longe', function () {
    listedEvent('longe', '2027-03-01 12:00:00');
    listedEvent('perto', '2026-11-20 12:00:00');
    listedEvent('passado', '2026-10-01 12:00:00');
    Event::factory()->create(['slug' => 'rascunho', 'starts_at' => '2026-11-15 12:00:00']);

    $response = getJson('/api/public/events')->assertOk();

    expect(collect($response->json('data'))->pluck('slug')->all())->toBe(['perto', 'longe'])
        ->and($response->json('meta'))->toBe(['page' => 1, 'per_page' => 12, 'total' => 2, 'last_page' => 1])
        ->and($response->headers->get('Cache-Control'))->toContain('no-cache');
});

it('com include_past traz os próximos primeiro e os passados depois, do mais recente ao mais antigo', function () {
    listedEvent('longe', '2027-03-01 12:00:00');
    listedEvent('perto', '2026-11-20 12:00:00');
    listedEvent('passado-antigo', '2026-08-01 12:00:00');
    listedEvent('passado-recente', '2026-10-15 12:00:00');

    $slugs = collect(getJson('/api/public/events?include_past=1')->assertOk()->json('data'))->pluck('slug')->all();

    expect($slugs)->toBe(['perto', 'longe', 'passado-recente', 'passado-antigo']);
});

it('o evento em andamento ainda é próximo, até o término', function () {
    listedEvent('em-andamento', '2026-11-09 12:00:00', ['ends_at' => '2026-11-11 12:00:00']);

    expect(getJson('/api/public/events')->json('data.0.slug'))->toBe('em-andamento');
});

it('pagina de 12 em 12', function () {
    foreach (range(1, 13) as $day) {
        listedEvent("dia-{$day}", Carbon::parse('2026-12-01 12:00:00')->addDays($day)->toDateTimeString());
    }

    expect(getJson('/api/public/events')->assertOk()->json('data'))->toHaveCount(12);
    $second = getJson('/api/public/events?page=2')->assertOk();
    expect($second->json('data'))->toHaveCount(1)->and($second->json('meta.last_page'))->toBe(2);
});

it('cada evento traz o estado derivado, o prazo e as vagas que sobram', function () {
    $event = listedEvent('com-vagas', '2026-12-05 12:00:00', ['max_spots' => 5, 'registration_deadline' => '2026-12-01 12:00:00']);
    EventRegistration::factory()->count(2)->create(['event_id' => $event->id]);
    listedEvent('lotado', '2026-12-06 12:00:00', ['max_spots' => 1]);
    EventRegistration::factory()->create(['event_id' => Event::query()->where('slug', 'lotado')->value('id')]);
    listedEvent('livre', '2026-12-07 12:00:00');

    $registrations = collect(getJson('/api/public/events')->json('data'))->keyBy('slug')->map(fn (array $row) => $row['registration']);

    expect($registrations['com-vagas'])->toBe(['state' => 'INSCRICOES_ABERTAS', 'deadline' => '2026-12-01T12:00:00Z', 'spots_total' => 5, 'spots_left' => 3])
        ->and($registrations['lotado'])->toBe(['state' => 'INSCRICOES_ENCERRADAS', 'deadline' => null, 'spots_total' => 1, 'spots_left' => 0])
        ->and($registrations['livre'])->toBe(['state' => 'INSCRICOES_ABERTAS', 'deadline' => null, 'spots_total' => null, 'spots_left' => null]);
});

it('o resumo traz o ministério só com id e nome, o banner pequeno e nenhum dado privado', function () {
    $ministry = MinistryGroup::factory()->create(['name' => 'Jovens', 'private_address' => 'Rua Reservada, 10', 'contact_email' => 'jovens@pibls.test']);
    listedEvent('retiro', '2026-12-05 12:00:00', ['ministry_id' => $ministry->id, 'banner_path' => 'eventos/2026/abc.webp']);

    $response = getJson('/api/public/events')->assertOk();

    expect($response->json('data.0.ministry'))->toBe(['id' => $ministry->id, 'name' => 'Jovens'])
        ->and($response->json('data.0.banner_small_url'))->toBe('/uploads/eventos/2026/abc-800.webp')
        ->and($response->getContent())->not->toContain('Rua Reservada')->not->toContain('jovens@pibls.test')->not->toContain('form_schema');
});

it('a página do evento traz a descrição, o aviso de menores e o formulário', function () {
    $schema = [['key' => 'camiseta', 'label' => 'Camiseta', 'type' => 'SELECT', 'required' => true, 'help_text' => null, 'sensitive' => false, 'min' => null, 'max' => null, 'options' => ['P', 'M']]];
    listedEvent('retiro', '2026-12-05 12:00:00', ['description' => '<p>Três dias.</p>', 'has_minors' => true, 'form_schema' => $schema, 'banner_path' => 'eventos/2026/abc.webp', 'max_spots' => 10]);

    $data = getJson('/api/public/events/retiro')->assertOk()->json('data');

    expect($data['slug'])->toBe('retiro')
        ->and($data['description'])->toBe('<p>Três dias.</p>')
        ->and($data['has_minors'])->toBeTrue()
        ->and($data['form_schema'])->toEqual($schema)
        ->and($data['banner_url'])->toBe('/uploads/eventos/2026/abc.webp')
        ->and($data['registration']['spots_left'])->toBe(10);
});

it('a página mostra o evento já realizado, com o estado REALIZADO', function () {
    listedEvent('passado', '2026-10-01 12:00:00');

    getJson('/api/public/events/passado')->assertOk()->assertJsonPath('data.registration.state', 'REALIZADO');
});

it('rascunho, evento que não existe e flag desligada respondem 404', function () {
    Event::factory()->create(['slug' => 'rascunho']);
    listedEvent('publicado', '2026-12-05 12:00:00');

    getJson('/api/public/events/rascunho')->assertNotFound();
    getJson('/api/public/events/nao-existe')->assertNotFound();

    config(['features.events' => false]);
    getJson('/api/public/events/publicado')->assertNotFound();
    getJson('/api/public/events')->assertNotFound();
});

it('recusa página inválida', function () {
    getJson('/api/public/events?page=0')->assertUnprocessable();
    getJson('/api/public/events?include_past=talvez')->assertUnprocessable();
});
