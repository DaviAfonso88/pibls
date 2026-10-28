<?php

declare(strict_types=1);

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Carbon;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;

/*
| Inscritos no painel (T188): /api/admin/events/{id}/registrations (contracts/openapi.yaml). Lista, CSV por streaming e
| cancelamento (BR-034, BR-081; FR-060 a FR-062; US11), com a flag FEATURE_EVENTS ligada.
*/

beforeEach(function () {
    config(['features.events' => true]);
    Carbon::setTestNow('2026-11-10 12:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/** @return array<int, array<string, mixed>> */
function regAdminSchema(): array
{
    return FormSchema::from([
        ['key' => 'camiseta', 'label' => 'Tamanho da camiseta', 'type' => 'SELECT', 'required' => true, 'options' => ['P', 'M', 'G']],
        ['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'required' => false],
        ['key' => 'peso', 'label' => 'Peso (kg)', 'type' => 'NUMBER', 'required' => false],
        ['key' => 'vegetariano', 'label' => 'Vegetariano', 'type' => 'BOOLEAN', 'required' => false],
    ])->toArray();
}

/** @param  array<string, mixed>  $overrides */
function regAdminEvent(array $overrides = []): Event
{
    return Event::factory()->published()->create([
        'slug' => 'retiro',
        'max_spots' => 4,
        'has_minors' => true,
        'form_schema' => regAdminSchema(),
        ...$overrides,
    ]);
}

/**
 * @param  array<string, mixed>  $overrides
 */
function regAdminRegistration(Event $event, array $overrides = []): EventRegistration
{
    return EventRegistration::factory()->create(['event_id' => $event->getKey(), ...$overrides]);
}

/** @return array<int, array<string, mixed>> */
function regAdminAnswers(string $size, ?string $allergies = null, int|float|null $weight = null, ?bool $vegetarian = null): array
{
    return array_values(array_filter([
        ['key' => 'camiseta', 'label' => 'Tamanho da camiseta', 'type' => 'SELECT', 'value' => $size],
        $allergies === null ? null : ['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'value' => $allergies],
        $weight === null ? null : ['key' => 'peso', 'label' => 'Peso (kg)', 'type' => 'NUMBER', 'value' => $weight],
        $vegetarian === null ? null : ['key' => 'vegetariano', 'label' => 'Vegetariano', 'type' => 'BOOLEAN', 'value' => $vegetarian],
    ]));
}

function regAdminUrl(Event $event, string $suffix = ''): string
{
    return "/api/admin/events/{$event->getKey()}/registrations{$suffix}";
}

/*
|--------------------------------------------------------------------------
| Flag desligada e autenticação
|--------------------------------------------------------------------------
*/

it('com FEATURE_EVENTS desligada toda rota de inscritos responde 404', function () {
    config(['features.events' => false]);
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    $registration = regAdminRegistration($event);

    getJson(regAdminUrl($event))->assertNotFound();
    getJson(regAdminUrl($event, '/export.csv'))->assertNotFound();
    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'CANCELLED'])->assertNotFound();

    expect(EventRegistration::query()->count())->toBe(1)->and(AuditLog::query()->count())->toBe(0);
});

it('sem sessão, as três rotas respondem 401', function () {
    $event = regAdminEvent();
    $registration = regAdminRegistration($event);

    getJson(regAdminUrl($event))->assertUnauthorized();
    getJson(regAdminUrl($event, '/export.csv'))->assertUnauthorized();
    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'CANCELLED'])->assertUnauthorized();
});

/*
|--------------------------------------------------------------------------
| Lista (FR-060)
|--------------------------------------------------------------------------
*/

it('FR-060 lista os inscritos com os campos fixos, as respostas na ordem do formulário e o contador de vagas', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    $first = regAdminRegistration($event, [
        'participant_name' => 'Ana Souza',
        'phone' => '+5531988776655',
        'email' => 'ana@example.com',
        'guardian_name' => 'Rita Souza',
        'guardian_phone' => '+5531977665544',
        'answers' => regAdminAnswers('M', 'Amendoim', 70.5, true),
        'created_at' => '2026-11-02 15:30:00',
    ]);
    regAdminRegistration($event, ['participant_name' => 'Bruno Lima', 'email' => null, 'answers' => [], 'created_at' => '2026-11-03 10:00:00']);

    $response = getJson(regAdminUrl($event))->assertOk();

    $response->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.spots_total', 4)
        ->assertJsonPath('meta.spots_filled', 2)
        ->assertJsonPath('data.0.id', $first->getKey())
        ->assertJsonPath('data.0.created_at', '2026-11-02T15:30:00Z')
        ->assertJsonPath('data.0.participant_name', 'Ana Souza')
        ->assertJsonPath('data.0.phone', '+5531988776655')
        ->assertJsonPath('data.0.email', 'ana@example.com')
        ->assertJsonPath('data.0.guardian_name', 'Rita Souza')
        ->assertJsonPath('data.0.guardian_phone', '+5531977665544')
        ->assertJsonPath('data.0.answers', regAdminAnswers('M', 'Amendoim', 70.5, true))
        ->assertJsonPath('data.1.participant_name', 'Bruno Lima')
        ->assertJsonPath('data.1.email', null)
        ->assertJsonPath('data.1.answers', []);
    expect(array_keys($response->json('data.0')))->toBe([
        'id', 'created_at', 'participant_name', 'phone', 'email', 'guardian_name', 'guardian_phone', 'answers',
    ]);
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
});

it('evento sem limite de vagas devolve spots_total nulo e o total de inscritos', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent(['max_spots' => null]);
    regAdminRegistration($event);

    getJson(regAdminUrl($event))->assertOk()
        ->assertJsonPath('meta.spots_total', null)
        ->assertJsonPath('meta.spots_filled', 1);
});

it('lista só as inscrições do evento pedido', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    regAdminRegistration($event, ['participant_name' => 'Deste evento']);
    regAdminRegistration(regAdminEvent(['slug' => 'outro']), ['participant_name' => 'De outro evento']);

    $response = getJson(regAdminUrl($event))->assertOk();

    expect(array_column($response->json('data'), 'participant_name'))->toBe(['Deste evento']);
});

it('a lista aceita até 500 por página (para o PDF) e recusa mais que isso', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent(['max_spots' => null]);
    EventRegistration::factory()->count(30)->create(['event_id' => $event->getKey()]);

    getJson(regAdminUrl($event, '?per_page=500'))->assertOk()
        ->assertJsonPath('meta.per_page', 500)
        ->assertJsonCount(30, 'data');
    getJson(regAdminUrl($event, '?per_page=501'))->assertUnprocessable()
        ->assertJsonPath('error.details.0.field', 'per_page');
    getJson(regAdminUrl($event, '?per_page=10&page=3'))->assertOk()
        ->assertJsonPath('meta.last_page', 3)
        ->assertJsonCount(10, 'data');
});

it('busca por nome (sem confundir curinga do LIKE) ou por telefone', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    regAdminRegistration($event, ['participant_name' => 'Ana Souza', 'phone' => '+5531988776655']);
    regAdminRegistration($event, ['participant_name' => 'Bruno Lima', 'phone' => '+5531911112222']);
    regAdminRegistration($event, ['participant_name' => '100% Teste', 'phone' => '+5531900001111']);

    $names = fn (string $query) => array_column(getJson(regAdminUrl($event, '?q='.urlencode($query)))->assertOk()->json('data'), 'participant_name');

    expect($names('souza'))->toBe(['Ana Souza'])
        ->and($names('(31) 91111'))->toBe(['Bruno Lima'])
        ->and($names('100%'))->toBe(['100% Teste'])
        ->and($names('%'))->toBe(['100% Teste'])
        ->and($names('ninguém'))->toBe([]);
});

/*
|--------------------------------------------------------------------------
| CSV (FR-061)
|--------------------------------------------------------------------------
*/

it('FR-061 exporta o CSV em UTF-8 com BOM e ";", com as mesmas colunas do PDF (snapshot do formato)', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    regAdminRegistration($event, [
        'participant_name' => 'Ana Souza',
        'phone' => '+5531988776655',
        'email' => 'ana@example.com',
        'guardian_name' => 'Rita Souza',
        'guardian_phone' => '+5531977665544',
        'answers' => regAdminAnswers('M', 'Amendoim; nozes', 70.5, true),
        'created_at' => '2026-11-02 15:30:00',
    ]);
    regAdminRegistration($event, [
        'participant_name' => 'Bruno "Bi" Lima',
        'phone' => '+553133334444',
        'email' => null,
        'guardian_name' => null,
        'guardian_phone' => null,
        'answers' => regAdminAnswers('G', '=HYPERLINK("http://x")', 80, false),
        'created_at' => '2026-11-03 10:00:00',
    ]);

    $response = getJson(regAdminUrl($event, '/export.csv'))->assertOk();

    expect($response->headers->get('Content-Type'))->toBe('text/csv; charset=UTF-8')
        ->and($response->headers->get('Content-Disposition'))->toBe('attachment; filename="inscritos-retiro-20261110.csv"')
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');

    $expected = implode("\r\n", [
        'Inscrito em;Nome;Telefone;E-mail;Responsável;Telefone do responsável;Tamanho da camiseta;Alergias;Peso (kg);Vegetariano',
        '02/11/2026 12:30;Ana Souza;(31) 98877-6655;ana@example.com;Rita Souza;(31) 97766-5544;M;"Amendoim; nozes";70,5;Sim',
        '03/11/2026 07:00;"Bruno ""Bi"" Lima";(31) 3333-4444;;;;G;"\'=HYPERLINK(""http://x"")";80;Não',
        '',
    ]);
    expect($response->streamedContent())->toBe("\xEF\xBB\xBF".$expected);
});

it('FR-061 sem inscrições, o CSV traz só o cabeçalho; sem menores, sem as colunas do responsável', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent(['has_minors' => false]);

    $content = getJson(regAdminUrl($event, '/export.csv'))->assertOk()->streamedContent();

    expect($content)->toBe("\xEF\xBB\xBF"."Inscrito em;Nome;Telefone;E-mail;Tamanho da camiseta;Alergias;Peso (kg);Vegetariano\r\n");
});

it('o CSV exporta mais de um bloco de linhas sem perder nem repetir ninguém', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent(['max_spots' => null, 'form_schema' => []]);
    EventRegistration::factory()->count(450)->create(['event_id' => $event->getKey()]);

    $lines = explode("\r\n", rtrim(getJson(regAdminUrl($event, '/export.csv'))->assertOk()->streamedContent(), "\r\n"));

    expect($lines)->toHaveCount(451)
        ->and(count(array_unique($lines)))->toBe(451);
});

it('a exportação é auditada como registrations.exported, só com o evento e a quantidade', function () {
    $user = asStaff('COMUNICACAO');
    $event = regAdminEvent();
    regAdminRegistration($event, ['participant_name' => 'Ana Souza', 'phone' => '+5531988776655']);
    regAdminRegistration($event);

    getJson(regAdminUrl($event, '/export.csv'))->assertOk()->streamedContent();

    $audit = AuditLog::query()->where('action', 'registrations.exported')->sole();
    expect($audit->actor_user_id)->toBe($user->getKey())
        ->and($audit->resource_type)->toBe('event')
        ->and($audit->resource_id)->toBe((string) $event->getKey())
        ->and($audit->changes)->toBe(['count' => 2])
        ->and(json_encode($audit->toArray()))->not->toContain('Ana Souza', '988776655');
});

it('a exportação tem o limite admin-export: 10 por 10 minutos por usuário', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();

    for ($i = 0; $i < 10; $i++) {
        getJson(regAdminUrl($event, '/export.csv'))->assertOk()->streamedContent();
    }

    getJson(regAdminUrl($event, '/export.csv'))->assertTooManyRequests();
    expect(AuditLog::query()->where('action', 'registrations.exported')->count())->toBe(10);
});

/*
|--------------------------------------------------------------------------
| Cancelamento (BR-034, BR-081, FR-062)
|--------------------------------------------------------------------------
*/

it('BR-034 cancelar exclui a inscrição em definitivo e devolve a vaga', function () {
    $user = asStaff('COMUNICACAO');
    $event = regAdminEvent(['max_spots' => 2]);
    $keep = regAdminRegistration($event);
    $cancelled = regAdminRegistration($event, ['participant_name' => 'Ana Souza', 'phone' => '+5531988776655']);

    getJson("/api/public/events/{$event->slug}")->assertOk()->assertJsonPath('data.registration.spots_left', 0);

    deleteJson(regAdminUrl($event, "/{$cancelled->getKey()}"), ['reason' => 'CANCELLED'])->assertNoContent();

    expect(EventRegistration::query()->pluck('id')->all())->toBe([$keep->getKey()]);
    getJson(regAdminUrl($event))->assertOk()->assertJsonPath('meta.spots_filled', 1);
    getJson("/api/public/events/{$event->slug}")->assertOk()->assertJsonPath('data.registration.spots_left', 1);

    $audit = AuditLog::query()->where('action', 'registration.cancelled')->sole();
    expect($audit->actor_user_id)->toBe($user->getKey())
        ->and($audit->resource_type)->toBe('event_registration')
        ->and($audit->resource_id)->toBe((string) $cancelled->getKey())
        ->and($audit->changes)->toEqual(['event_id' => $event->getKey(), 'reason' => 'CANCELLED'])
        ->and(json_encode($audit->toArray()))->not->toContain('Ana Souza', '988776655');
});

it('BR-081 a exclusão a pedido do titular também é definitiva e fica auditada como registration.erased', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    $registration = regAdminRegistration($event);

    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'TITULAR_REQUEST'])->assertNoContent();

    expect(EventRegistration::query()->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'registration.erased')->sole()->changes['reason'])->toBe('TITULAR_REQUEST')
        ->and(AuditLog::query()->where('action', 'registration.cancelled')->count())->toBe(0);
});

it('o cancelamento exige o motivo, e só um dos dois motivos', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    $registration = regAdminRegistration($event);
    $url = regAdminUrl($event, "/{$registration->getKey()}");

    deleteJson($url)->assertUnprocessable()->assertJsonPath('error.details.0.field', 'reason');
    deleteJson($url, ['reason' => 'OUTRO'])->assertUnprocessable()->assertJsonPath('error.details.0.field', 'reason');

    expect(EventRegistration::query()->count())->toBe(1);
});

it('uma inscrição de outro evento na URL é 404 e nada é excluído', function () {
    asStaff('COMUNICACAO');
    $event = regAdminEvent();
    $foreign = regAdminRegistration(regAdminEvent(['slug' => 'outro']));

    deleteJson(regAdminUrl($event, "/{$foreign->getKey()}"), ['reason' => 'CANCELLED'])->assertNotFound();
    deleteJson(regAdminUrl($event, '/999999'), ['reason' => 'CANCELLED'])->assertNotFound();

    expect(EventRegistration::query()->count())->toBe(1);
});

/*
|--------------------------------------------------------------------------
| Papéis e escopo (BR-030, BR-075, BR-076)
|--------------------------------------------------------------------------
*/

it('BR-030 o líder (.own) vê, exporta e cancela as inscrições do próprio ministério', function () {
    $leader = asStaff('LIDER_MINISTERIO');
    $event = regAdminEvent(['ministry_id' => $leader->ministry_id]);
    $registration = regAdminRegistration($event);

    getJson(regAdminUrl($event))->assertOk()->assertJsonPath('meta.total', 1);
    getJson(regAdminUrl($event, '/export.csv'))->assertOk()->streamedContent();
    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'CANCELLED'])->assertNoContent();
});

it('BR-030 evento de outro ministério é inexistente (404) para o líder, nas três rotas', function () {
    asStaff('LIDER_MINISTERIO');
    $foreign = regAdminEvent();
    $registration = regAdminRegistration($foreign);

    getJson(regAdminUrl($foreign))->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    getJson(regAdminUrl($foreign, '/export.csv'))->assertNotFound();
    deleteJson(regAdminUrl($foreign, "/{$registration->getKey()}"), ['reason' => 'CANCELLED'])->assertNotFound();

    expect(EventRegistration::query()->count())->toBe(1)->and(AuditLog::query()->count())->toBe(0);
});

it('BR-076 a Secretaria vê e exporta, mas não cancela (403), mesmo com um corpo inválido', function () {
    asStaff('SECRETARIA');
    $event = regAdminEvent();
    $registration = regAdminRegistration($event);

    getJson(regAdminUrl($event))->assertOk();
    getJson(regAdminUrl($event, '/export.csv'))->assertOk()->streamedContent();
    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'INVALIDO'])->assertForbidden();
    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'CANCELLED'])->assertForbidden();

    expect(EventRegistration::query()->count())->toBe(1);
});

it('BR-076 quem não tem permissão de inscritos recebe 403 nas três rotas', function () {
    asStaff('TESOURARIA');
    $event = regAdminEvent();
    $registration = regAdminRegistration($event);

    getJson(regAdminUrl($event))->assertForbidden();
    getJson(regAdminUrl($event, '/export.csv'))->assertForbidden();
    deleteJson(regAdminUrl($event, "/{$registration->getKey()}"), ['reason' => 'CANCELLED'])->assertForbidden();

    expect(AuditLog::query()->count())->toBe(0);
});

it('BR-075 o líder sem ministério vinculado não vê inscrição nenhuma', function () {
    asStaff('LIDER_MINISTERIO', ['ministry_id' => null]);
    $event = regAdminEvent();

    getJson(regAdminUrl($event))->assertForbidden();
});
