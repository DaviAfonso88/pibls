<?php

declare(strict_types=1);

use App\Modules\Content\Snapshots\HomeSnapshot;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Snapshots\UpcomingEventsSection;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Support\Carbon;

use function Pest\Laravel\get;

/*
| T177: com a flag FEATURE_EVENTS ligada, a página do evento recebe a meta injetada (JSON-LD `Event`, og:image = banner), o
| sitemap lista os eventos publicados e a home.json traz os próximos (`upcoming_events`). Desligada, nada disso existe.
*/

beforeEach(function () {
    config(['features.events' => true, 'app.url' => 'https://pibls.test']);
    Carbon::setTestNow('2026-11-10 12:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/** @param  array<string, mixed>  $overrides */
function publishedEvent(array $overrides = []): Event
{
    return Event::factory()->published()->create([
        'starts_at' => '2026-12-05 12:00:00',
        'ends_at' => '2026-12-07 15:00:00',
        ...$overrides,
    ]);
}

/** @return array<string, mixed> */
function eventJsonLd(string $html): array
{
    preg_match('#<script type="application/ld\+json">(.*?)</script>#s', $html, $match);

    return (array) json_decode($match[1] ?? '{}', true);
}

/*
|--------------------------------------------------------------------------
| GET /eventos/{slug}
|--------------------------------------------------------------------------
*/

it('injeta a meta do evento: título, resumo, canonical, og:image e JSON-LD Event', function () {
    $event = publishedEvent([
        'title' => 'Retiro de jovens', 'slug' => 'retiro-de-jovens', 'excerpt' => 'Três dias de louvor.', 'location' => 'Chácara Boa Vista',
        'banner_path' => 'eventos/2026/'.str_repeat('a', 32).'.webp',
    ]);

    $response = get("/eventos/{$event->slug}")->assertOk();
    $html = $response->getContent();

    expect($html)->toContain('<title>Retiro de jovens — PIBLS</title>')
        ->toContain('<meta name="description" content="Três dias de louvor.">')
        ->toContain('<link rel="canonical" href="https://pibls.test/eventos/retiro-de-jovens">')
        ->toContain('<meta property="og:image" content="https://pibls.test/uploads/eventos/2026/'.str_repeat('a', 32).'.webp">')
        ->not->toContain('noindex');

    $ld = eventJsonLd($html);
    expect($ld['@type'])->toBe('Event')
        ->and($ld['name'])->toBe('Retiro de jovens')
        ->and($ld['description'])->toBe('Três dias de louvor.')
        ->and($ld['startDate'])->toBe('2026-12-05T09:00:00-03:00')
        ->and($ld['endDate'])->toBe('2026-12-07T12:00:00-03:00')
        ->and($ld['location'])->toBe(['@type' => 'Place', 'name' => 'Chácara Boa Vista', 'address' => 'Chácara Boa Vista'])
        ->and($ld['image'])->toBe(['https://pibls.test/uploads/eventos/2026/'.str_repeat('a', 32).'.webp'])
        ->and($ld['url'])->toBe('https://pibls.test/eventos/retiro-de-jovens');

    expect($response->headers->get('Cache-Control'))->toContain('public');
});

it('sem banner, usa a imagem padrão da igreja; sem término, o JSON-LD não traz endDate', function () {
    $event = publishedEvent(['ends_at' => null, 'banner_path' => null]);

    $html = get("/eventos/{$event->slug}")->assertOk()->getContent();

    expect($html)->toContain('<meta property="og:image" content="https://pibls.test/og-default.png">')
        ->and(eventJsonLd($html))->not->toHaveKey('endDate');
});

it('escapa o que vem do banco: um título com marcação não fecha a tag nem escapa do JSON-LD', function () {
    $event = publishedEvent(['title' => 'Culto "especial" <script>alert(1)</script>', 'excerpt' => '</script><b>x</b>']);

    $html = get("/eventos/{$event->slug}")->assertOk()->getContent();

    expect($html)->not->toContain('<script>alert(1)</script>')->not->toContain('</script><b>x</b>')
        ->and(eventJsonLd($html)['name'])->toBe('Culto "especial" <script>alert(1)</script>');
});

it('rascunho, endereço inexistente e flag desligada respondem 404 com noindex e sem cookie', function () {
    $draft = Event::factory()->create();
    $published = publishedEvent();

    foreach ([$draft->slug, 'nao-existe'] as $slug) {
        $response = get("/eventos/{$slug}")->assertNotFound();
        expect($response->getContent())->toContain('<meta name="robots" content="noindex">')->and($response->headers->get('Cache-Control'))->toContain('no-store');
        expect($response->headers->all('set-cookie'))->toBe([]);
    }

    config(['features.events' => false]);
    get("/eventos/{$published->slug}")->assertNotFound();
});

it('não deixa o titulo de um rascunho vazar na página 404', function () {
    $draft = Event::factory()->create(['title' => 'Segredo do rascunho']);

    expect(get("/eventos/{$draft->slug}")->assertNotFound()->getContent())->not->toContain('Segredo do rascunho');
});

/*
|--------------------------------------------------------------------------
| sitemap.xml
|--------------------------------------------------------------------------
*/

it('o sitemap lista a página de eventos e cada evento publicado, com lastmod, e nunca um rascunho', function () {
    $event = publishedEvent(['slug' => 'retiro-de-jovens']);
    $event->forceFill(['updated_at' => '2026-11-09 10:00:00'])->saveQuietly();
    $draft = Event::factory()->create(['slug' => 'rascunho-secreto']);

    $xml = get('/sitemap.xml')->assertOk()->getContent();

    expect($xml)->toContain('<loc>https://pibls.test/eventos</loc>')
        ->toContain('<loc>https://pibls.test/eventos/retiro-de-jovens</loc><lastmod>2026-11-09</lastmod>')
        ->not->toContain($draft->slug);
});

it('com a flag desligada o sitemap não tem nenhuma página de evento', function () {
    publishedEvent(['slug' => 'retiro-de-jovens']);
    config(['features.events' => false]);

    expect(get('/sitemap.xml')->assertOk()->getContent())->not->toContain('/eventos');
});

/*
|--------------------------------------------------------------------------
| home.json: upcoming_events
|--------------------------------------------------------------------------
*/

it('home.json: até 3 próximos eventos publicados, do mais próximo ao mais distante, no formato EventSummary', function () {
    $ministry = MinistryGroup::factory()->create(['name' => 'Jovens', 'private_address' => 'Rua Secreta, 1', 'contact_email' => 'segredo@example.com']);
    $later = publishedEvent(['starts_at' => '2026-12-20 12:00:00', 'ends_at' => null]);
    $soon = publishedEvent(['starts_at' => '2026-11-12 12:00:00', 'ends_at' => null, 'ministry_id' => $ministry->getKey(), 'max_spots' => 10]);
    $middle = publishedEvent(['starts_at' => '2026-12-01 12:00:00', 'ends_at' => null]);
    publishedEvent(['starts_at' => '2027-03-01 12:00:00', 'ends_at' => null]);
    Event::factory()->create(['starts_at' => '2026-11-11 12:00:00']); // rascunho
    publishedEvent(['starts_at' => '2026-10-01 12:00:00', 'ends_at' => '2026-10-02 12:00:00']); // já realizado

    $events = app(UpcomingEventsSection::class)->build();

    expect(array_column($events, 'id'))->toBe([$soon->getKey(), $middle->getKey(), $later->getKey()]);
    expect($events[0])->toMatchArray([
        'slug' => $soon->slug,
        'title' => $soon->title,
        'ministry' => ['id' => $ministry->getKey(), 'name' => 'Jovens'],
        'starts_at' => '2026-11-12T12:00:00Z',
        'ends_at' => null,
        'registration' => ['state' => 'INSCRICOES_ABERTAS', 'deadline' => null, 'spots_total' => 10, 'spots_left' => 10],
    ]);

    $json = json_encode($events, JSON_THROW_ON_ERROR);
    expect($json)->not->toContain('Rua Secreta')->not->toContain('segredo@example.com')->not->toContain('private_address')->not->toContain('contact_email');
});

it('home.json: um evento em andamento ainda é "próximo"; ao terminar, sai da lista', function () {
    $running = publishedEvent(['starts_at' => '2026-11-10 09:00:00', 'ends_at' => '2026-11-10 18:00:00']);

    expect(array_column(app(UpcomingEventsSection::class)->build(), 'id'))->toBe([$running->getKey()]);

    Carbon::setTestNow('2026-11-10 18:00:01');

    expect(app(UpcomingEventsSection::class)->build())->toBe([]);
});

it('home.json: com a flag desligada, upcoming_events é sempre vazio', function () {
    publishedEvent();
    config(['features.events' => false]);

    expect(app(UpcomingEventsSection::class)->build())->toBe([]);
});

it('o snapshot home entrega upcoming_events pelo mesmo caminho que a API pública usa', function () {
    $event = publishedEvent();

    $home = app(HomeSnapshot::class)->build();

    expect(array_column($home['upcoming_events'], 'id'))->toBe([$event->getKey()])
        ->and($home)->toHaveKeys(['latest_bulletin', 'latest_posts', 'upcoming_events']);

    config(['features.events' => false]);
    expect(app(HomeSnapshot::class)->build()['upcoming_events'])->toBe([]);
});

it('o evento agendado pelo tempo faz o agendador regenerar a home: início, término e fim do prazo no intervalo', function () {
    publishedEvent(['starts_at' => '2026-12-05 12:00:00', 'ends_at' => '2026-12-05 18:00:00', 'registration_deadline' => '2026-12-04 12:00:00']);
    $section = app(UpcomingEventsSection::class);
    $at = fn (string $moment) => Carbon::parse($moment, 'UTC');

    // O intervalo é (since, until]
    expect($section->hasScheduledChange($at('2026-12-04 11:00:00'), $at('2026-12-04 12:00:00')))->toBeTrue()   // prazo
        ->and($section->hasScheduledChange($at('2026-12-04 12:00:00'), $at('2026-12-05 11:59:59')))->toBeFalse()
        ->and($section->hasScheduledChange($at('2026-12-05 11:59:59'), $at('2026-12-05 12:00:00')))->toBeTrue() // início
        ->and($section->hasScheduledChange($at('2026-12-05 17:00:00'), $at('2026-12-05 18:00:00')))->toBeTrue() // término
        ->and($section->hasScheduledChange($at('2026-12-05 18:00:00'), $at('2026-12-06 00:00:00')))->toBeFalse();
});

it('rascunho nunca agenda mudança na home, nem com a flag desligada', function () {
    Event::factory()->create(['starts_at' => '2026-12-05 12:00:00']);
    $section = app(UpcomingEventsSection::class);

    expect($section->hasScheduledChange(Carbon::parse('2026-12-05 11:00:00', 'UTC'), Carbon::parse('2026-12-05 13:00:00', 'UTC')))->toBeFalse();

    publishedEvent(['starts_at' => '2026-12-05 12:00:00']);
    config(['features.events' => false]);
    expect($section->hasScheduledChange(Carbon::parse('2026-12-05 11:00:00', 'UTC'), Carbon::parse('2026-12-05 13:00:00', 'UTC')))->toBeFalse();
});
