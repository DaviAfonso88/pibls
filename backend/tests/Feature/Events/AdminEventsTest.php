<?php

declare(strict_types=1);

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event as EventBus;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

/*
| Painel de eventos (T168): /api/admin/events (contracts/openapi.yaml). BR-025 a BR-033 e BR-045 (US9), com a flag
| FEATURE_EVENTS ligada. Os testes do R1 seguem com ela desligada, que é o padrão.
*/

beforeEach(function () {
    config(['features.events' => true]);
    Storage::fake('uploads');
    Carbon::setTestNow('2026-11-10 12:00:00');
});

afterEach(fn () => Carbon::setTestNow());

/** @return array<string, mixed> */
function adminEventFields(array $overrides = []): array
{
    return [
        'title' => 'Retiro de jovens',
        'slug' => 'retiro-de-jovens',
        'ministry_id' => MinistryGroup::factory()->create()->getKey(),
        'description' => '<p>Três dias de louvor e comunhão.</p>',
        'starts_at' => '2026-12-05T09:00:00-03:00',
        'ends_at' => '2026-12-07T12:00:00-03:00',
        'location' => 'Chácara Boa Vista',
        ...$overrides,
    ];
}

/** @return array<string, mixed> */
function adminEventSchema(): array
{
    return [
        ['key' => 'camiseta', 'label' => 'Tamanho da camiseta', 'type' => 'SELECT', 'required' => true, 'options' => ['P', 'M', 'G']],
        ['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXT', 'required' => false],
    ];
}

/** @param  array<string, mixed>  $overrides */
function adminEvent(array $overrides = []): Event
{
    return Event::factory()->create($overrides);
}

function adminEventRegistrations(Event $event, int $count): void
{
    EventRegistration::factory()->count($count)->create(['event_id' => $event->getKey()]);
}

function adminEventImage(string $name = 'banner.png', int $width = 2400, int $height = 1200): UploadedFile
{
    return UploadedFile::fake()->image($name, $width, $height);
}

function postAdminEventBanner(Event $event, ?UploadedFile $file = null): TestResponse
{
    return test()->post("/api/admin/events/{$event->getKey()}/banner", ['banner' => $file ?? adminEventImage()], ['Accept' => 'application/json']);
}

/** @return list<int> larguras dos arquivos de imagem gravados em `uploads` */
function adminEventStoredWidths(): array
{
    $widths = [];
    foreach (Storage::disk('uploads')->allFiles() as $path) {
        $widths[] = getimagesizefromstring(Storage::disk('uploads')->get($path))[0];
    }
    sort($widths);

    return $widths;
}

/*
|--------------------------------------------------------------------------
| Flag desligada
|--------------------------------------------------------------------------
*/

it('com FEATURE_EVENTS desligada toda rota de /api/admin/events responde 404', function () {
    config(['features.events' => false]);
    asStaff('COMUNICACAO');
    $event = adminEvent();

    getJson('/api/admin/events')->assertNotFound();
    postJson('/api/admin/events', adminEventFields())->assertNotFound();
    getJson("/api/admin/events/{$event->getKey()}")->assertNotFound();
    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'Novo'])->assertNotFound();
    deleteJson("/api/admin/events/{$event->getKey()}")->assertNotFound();
    postAdminEventBanner($event)->assertNotFound();
    deleteJson("/api/admin/events/{$event->getKey()}/banner")->assertNotFound();

    expect(Event::query()->count())->toBe(1)->and($event->fresh()->title)->toBe($event->title);
});

/*
|--------------------------------------------------------------------------
| Criar e ler
|--------------------------------------------------------------------------
*/

it('cadastra um evento como rascunho e responde 201 no formato EventAdmin', function () {
    $user = asStaff('COMUNICACAO');
    $fields = adminEventFields(['max_spots' => 40, 'registration_deadline' => '2026-12-01T23:59:00-03:00', 'has_minors' => true, 'form_schema' => adminEventSchema()]);

    $response = postJson('/api/admin/events', $fields)->assertCreated();

    $response->assertJsonPath('data.title', 'Retiro de jovens')
        ->assertJsonPath('data.slug', 'retiro-de-jovens')
        ->assertJsonPath('data.ministry.id', $fields['ministry_id'])
        ->assertJsonPath('data.description', '<p>Três dias de louvor e comunhão.</p>')
        ->assertJsonPath('data.excerpt', 'Três dias de louvor e comunhão.')
        ->assertJsonPath('data.starts_at', '2026-12-05T12:00:00Z')
        ->assertJsonPath('data.ends_at', '2026-12-07T15:00:00Z')
        ->assertJsonPath('data.location', 'Chácara Boa Vista')
        ->assertJsonPath('data.max_spots', 40)
        ->assertJsonPath('data.registration_deadline', '2026-12-02T02:59:00Z')
        ->assertJsonPath('data.has_minors', true)
        ->assertJsonPath('data.is_published', false)
        ->assertJsonPath('data.registrations_count', 0)
        ->assertJsonPath('data.banner_url', null)
        ->assertJsonPath('data.banner_small_url', null)
        ->assertJsonPath('data.registration.state', 'RASCUNHO')
        ->assertJsonPath('data.registration.spots_total', 40)
        ->assertJsonPath('data.registration.spots_left', 40)
        ->assertJsonPath('data.updated_by.id', $user->getKey())
        ->assertJsonPath('data.form_schema.0.key', 'camiseta')
        ->assertJsonPath('data.form_schema.0.sensitive', false)
        ->assertJsonPath('data.form_schema.0.options', ['P', 'M', 'G'])
        ->assertJsonMissingPath('sanitization_warning');

    $event = Event::query()->firstOrFail();
    expect($event->created_by)->toBe($user->getKey())
        ->and($event->is_published)->toBeFalse()
        ->and($event->starts_at->utc()->toIso8601String())->toBe('2026-12-05T12:00:00+00:00')
        ->and($event->form_schema)->toHaveCount(2);

    $audit = AuditLog::query()->where('action', 'event.created')->firstOrFail();
    expect($audit->resource_type)->toBe('event')->and($audit->resource_id)->toBe((string) $event->getKey());
});

it('sem fuso, o horário enviado vale em Brasília; sem formulário nem opcionais, usa os padrões', function () {
    asStaff('COMUNICACAO');

    $response = postJson('/api/admin/events', adminEventFields(['starts_at' => '2026-12-05T09:00', 'ends_at' => null]))->assertCreated();

    $response->assertJsonPath('data.starts_at', '2026-12-05T12:00:00Z')
        ->assertJsonPath('data.ends_at', null)
        ->assertJsonPath('data.max_spots', null)
        ->assertJsonPath('data.registration_deadline', null)
        ->assertJsonPath('data.has_minors', false)
        ->assertJsonPath('data.form_schema', [])
        ->assertJsonPath('data.registration.spots_left', null);
});

it('BR-046 a descrição é sanitizada no servidor, o resumo sai dela e a resposta avisa quando algo foi removido', function () {
    asStaff('COMUNICACAO');

    $response = postJson('/api/admin/events', adminEventFields(['description' => '<p>Venha <strong>louvar</strong>.</p><script>alert(1)</script>']))->assertCreated();

    $response->assertJsonPath('sanitization_warning', true)
        ->assertJsonPath('data.description', '<p>Venha <strong>louvar</strong>.</p>')
        ->assertJsonPath('data.excerpt', 'Venha louvar.');
});

it('recusa uma descrição que só tinha marcação proibida', function () {
    asStaff('COMUNICACAO');

    postJson('/api/admin/events', adminEventFields(['description' => '<script>alert(1)</script>']))
        ->assertUnprocessable()
        ->assertFieldError('description', 'Escreva a descrição do evento.');
});

it('o resumo tem no máximo 300 caracteres', function () {
    asStaff('COMUNICACAO');

    $response = postJson('/api/admin/events', adminEventFields(['description' => '<p>'.str_repeat('palavra ', 80).'</p>']))->assertCreated();

    expect(mb_strlen((string) $response->json('data.excerpt')))->toBeLessThanOrEqual(300);
});

it('valida os campos obrigatórios e os formatos', function () {
    asStaff('COMUNICACAO');

    postJson('/api/admin/events', [])
        ->assertUnprocessable()
        ->assertFieldErrors(['title', 'slug', 'ministry_id', 'description', 'starts_at', 'location']);

    postJson('/api/admin/events', adminEventFields(['slug' => 'Retiro De Jovens', 'ministry_id' => 999_999, 'max_spots' => 0, 'title' => str_repeat('a', 151)]))
        ->assertUnprocessable()
        ->assertFieldErrors(['slug', 'ministry_id', 'max_spots', 'title']);
});

it('o evento só pode ser de um ministério ativo', function () {
    asStaff('COMUNICACAO');
    $inactive = MinistryGroup::factory()->create(['is_active' => false]);

    postJson('/api/admin/events', adminEventFields(['ministry_id' => $inactive->getKey()]))
        ->assertUnprocessable()
        ->assertFieldErrors(['ministry_id']);
});

it('mostra um evento para editar', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['title' => 'Culto de gratidão', 'form_schema' => adminEventSchema()]);
    adminEventRegistrations($event, 2);

    getJson("/api/admin/events/{$event->getKey()}")
        ->assertOk()
        ->assertJsonPath('data.title', 'Culto de gratidão')
        ->assertJsonPath('data.registrations_count', 2)
        ->assertJsonPath('data.form_schema.1.key', 'alergias');

    getJson('/api/admin/events/999999')->assertNotFound();
});

/*
|--------------------------------------------------------------------------
| BR-025, BR-026, BR-027
|--------------------------------------------------------------------------
*/

it('BR-025 recusa um término anterior ao início, e aceita término igual ao início ou nenhum', function () {
    asStaff('COMUNICACAO');

    postJson('/api/admin/events', adminEventFields(['starts_at' => '2026-12-05T09:00-03:00', 'ends_at' => '2026-12-05T08:59-03:00']))
        ->assertUnprocessable()
        ->assertFieldError('ends_at', 'O término precisa ser depois do início.');

    postJson('/api/admin/events', adminEventFields(['slug' => 'um', 'starts_at' => '2026-12-05T09:00-03:00', 'ends_at' => '2026-12-05T09:00-03:00']))->assertCreated();
    postJson('/api/admin/events', adminEventFields(['slug' => 'dois', 'ends_at' => null]))->assertCreated();
});

it('BR-025 vale também ao alterar só uma das datas', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['starts_at' => '2026-12-05 12:00:00', 'ends_at' => '2026-12-05 18:00:00']);

    patchJson("/api/admin/events/{$event->getKey()}", ['starts_at' => '2026-12-06T09:00:00-03:00'])
        ->assertUnprocessable()
        ->assertFieldError('ends_at', 'O término precisa ser depois do início.');

    patchJson("/api/admin/events/{$event->getKey()}", ['ends_at' => '2026-12-05T08:00:00-03:00'])
        ->assertUnprocessable()
        ->assertFieldError('ends_at', 'O término precisa ser depois do início.');

    expect($event->fresh()->ends_at->utc()->format('H:i'))->toBe('18:00');
});

it('BR-026 o prazo de inscrição não passa do início do evento', function () {
    asStaff('COMUNICACAO');

    postJson('/api/admin/events', adminEventFields(['starts_at' => '2026-12-05T09:00-03:00', 'registration_deadline' => '2026-12-05T09:01-03:00']))
        ->assertUnprocessable()
        ->assertFieldError('registration_deadline', 'O prazo de inscrição precisa terminar antes do início do evento.');

    postJson('/api/admin/events', adminEventFields(['slug' => 'no-limite', 'starts_at' => '2026-12-05T09:00-03:00', 'registration_deadline' => '2026-12-05T09:00-03:00']))->assertCreated();
});

it('BR-026 vale ao mudar só o início para antes do prazo', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['starts_at' => '2026-12-05 12:00:00', 'ends_at' => null, 'registration_deadline' => '2026-12-04 12:00:00']);

    patchJson("/api/admin/events/{$event->getKey()}", ['starts_at' => '2026-12-03T09:00:00-03:00'])
        ->assertUnprocessable()
        ->assertFieldError('registration_deadline', 'O prazo de inscrição precisa terminar antes do início do evento.');
});

it('BR-027 as vagas não podem ficar abaixo do número de inscritos', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['max_spots' => 10]);
    adminEventRegistrations($event, 3);

    patchJson("/api/admin/events/{$event->getKey()}", ['max_spots' => 2])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'SPOTS_BELOW_REGISTRATIONS')
        ->assertJsonPath('error.message', 'Já existem 3 inscritos; o número de vagas não pode ser menor.');

    expect($event->fresh()->max_spots)->toBe(10);

    patchJson("/api/admin/events/{$event->getKey()}", ['max_spots' => 3])->assertOk()->assertJsonPath('data.registration.spots_left', 0);
    patchJson("/api/admin/events/{$event->getKey()}", ['max_spots' => null])->assertOk()->assertJsonPath('data.max_spots', null);
});

/*
|--------------------------------------------------------------------------
| BR-028
|--------------------------------------------------------------------------
*/

it('BR-028 exclui definitivamente um evento sem inscrições e apaga o banner', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();
    postAdminEventBanner($event)->assertOk();
    expect(Storage::disk('uploads')->allFiles())->toHaveCount(2);

    deleteJson("/api/admin/events/{$event->getKey()}")->assertNoContent();

    expect(Event::query()->count())->toBe(0)
        ->and(Storage::disk('uploads')->allFiles())->toBe([]);
    $audit = AuditLog::query()->where('action', 'event.deleted')->firstOrFail();
    expect($audit->resource_id)->toBe((string) $event->getKey());
});

it('BR-028 um evento com inscrições não pode ser excluído', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();
    adminEventRegistrations($event, 1);

    deleteJson("/api/admin/events/{$event->getKey()}")
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'EVENT_HAS_REGISTRATIONS')
        ->assertJsonPath('error.message', 'Este evento tem inscrições e não pode ser excluído. Despublique-o.');

    expect(Event::query()->count())->toBe(1)->and(AuditLog::query()->where('action', 'event.deleted')->count())->toBe(0);
});

/*
|--------------------------------------------------------------------------
| BR-029, BR-031
|--------------------------------------------------------------------------
*/

it('BR-029 remover campo ou trocar o tipo de um campo com inscrições pede confirmação', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['form_schema' => adminEventSchema()]);
    adminEventRegistrations($event, 1);
    $url = "/api/admin/events/{$event->getKey()}";

    $removed = [adminEventSchema()[0]];
    patchJson($url, ['form_schema' => $removed])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'SCHEMA_CHANGE_NEEDS_CONFIRMATION')
        ->assertJsonPath('error.message', 'Este campo já tem respostas. As respostas existentes serão mantidas com o rótulo atual. Confirmar?')
        ->assertJsonPath('error.details.0.field', 'form_schema')
        ->assertJsonPath('error.details.0.code', 'alergias');

    $retyped = [adminEventSchema()[0], ['key' => 'alergias', 'label' => 'Alergias', 'type' => 'TEXTAREA', 'required' => false]];
    patchJson($url, ['form_schema' => $retyped])->assertStatus(409)->assertJsonPath('error.code', 'SCHEMA_CHANGE_NEEDS_CONFIRMATION');

    expect($event->fresh()->form_schema)->toHaveCount(2);

    patchJson($url, ['form_schema' => $removed, 'confirm_schema_change' => true])
        ->assertOk()
        ->assertJsonCount(1, 'data.form_schema');
    expect($event->fresh()->form_schema)->toHaveCount(1);
});

it('BR-029 mudar rótulo, opções ou acrescentar campo não pede confirmação', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['form_schema' => adminEventSchema()]);
    adminEventRegistrations($event, 1);

    $schema = adminEventSchema();
    $schema[0]['label'] = 'Camiseta';
    $schema[0]['options'] = ['P', 'M', 'G', 'GG'];
    $schema[] = ['key' => 'carona', 'label' => 'Precisa de carona?', 'type' => 'BOOLEAN', 'required' => false];

    patchJson("/api/admin/events/{$event->getKey()}", ['form_schema' => $schema])
        ->assertOk()
        ->assertJsonCount(3, 'data.form_schema')
        ->assertJsonPath('data.form_schema.0.label', 'Camiseta');
});

it('BR-029 sem inscrições, o formulário muda à vontade', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['form_schema' => adminEventSchema()]);

    patchJson("/api/admin/events/{$event->getKey()}", ['form_schema' => []])->assertOk()->assertJsonPath('data.form_schema', []);
});

it('BR-031 recusa formulário inválido com a mensagem da regra', function () {
    asStaff('COMUNICACAO');
    $thirtyOne = array_map(fn (int $n) => ['key' => "campo_{$n}", 'label' => "Campo {$n}", 'type' => 'TEXT', 'required' => false], range(1, 31));

    postJson('/api/admin/events', adminEventFields(['form_schema' => $thirtyOne]))
        ->assertUnprocessable()
        ->assertFieldError('form_schema', 'O formulário pode ter no máximo 30 campos.');

    $duplicated = [...adminEventSchema(), adminEventSchema()[1]];
    postJson('/api/admin/events', adminEventFields(['form_schema' => $duplicated]))
        ->assertUnprocessable()
        ->assertFieldError('form_schema', 'Já existe um campo com a chave alergias.');

    $fewOptions = [['key' => 'cor', 'label' => 'Cor', 'type' => 'SELECT', 'required' => false, 'options' => ['Azul']]];
    postJson('/api/admin/events', adminEventFields(['form_schema' => $fewOptions]))
        ->assertUnprocessable()
        ->assertFieldError('form_schema', 'Informe de 2 a 30 opções diferentes.');

    $badKey = [['key' => 'Cor', 'label' => 'Cor', 'type' => 'TEXT', 'required' => false]];
    postJson('/api/admin/events', adminEventFields(['form_schema' => $badKey]))->assertUnprocessable()->assertFieldErrors(['form_schema']);

    expect(Event::query()->count())->toBe(0);
});

it('BR-083 guarda o marcador sensitive de cada campo', function () {
    asStaff('COMUNICACAO');
    $schema = [['key' => 'remedios', 'label' => 'Remédios de uso contínuo', 'type' => 'TEXT', 'required' => false, 'sensitive' => true], adminEventSchema()[0]];

    postJson('/api/admin/events', adminEventFields(['form_schema' => $schema]))
        ->assertCreated()
        ->assertJsonPath('data.form_schema.0.sensitive', true)
        ->assertJsonPath('data.form_schema.1.sensitive', false);
});

/*
|--------------------------------------------------------------------------
| BR-032
|--------------------------------------------------------------------------
*/

it('BR-032 o endereço é único entre os eventos', function () {
    asStaff('COMUNICACAO');
    adminEvent(['slug' => 'retiro-de-jovens']);

    postJson('/api/admin/events', adminEventFields())
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'DUPLICATE_SLUG')
        ->assertJsonPath('error.message', 'Já existe um item com este endereço. Escolha outro.');

    $other = adminEvent(['slug' => 'outro-evento']);
    patchJson("/api/admin/events/{$other->getKey()}", ['slug' => 'retiro-de-jovens'])->assertStatus(409)->assertJsonPath('error.code', 'DUPLICATE_SLUG');
    patchJson("/api/admin/events/{$other->getKey()}", ['slug' => 'outro-evento'])->assertOk();

    expect(Event::query()->count())->toBe(2);
});

/*
|--------------------------------------------------------------------------
| Alterar, publicar, despublicar, encerrar inscrições
|--------------------------------------------------------------------------
*/

it('altera só o que foi enviado e registra a auditoria', function () {
    $user = asStaff('COMUNICACAO');
    $event = adminEvent(['title' => 'Antes', 'location' => 'Salão', 'form_schema' => adminEventSchema()]);

    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'Depois', 'description' => '<p>Novo texto.</p>'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Depois')
        ->assertJsonPath('data.excerpt', 'Novo texto.')
        ->assertJsonPath('data.location', 'Salão')
        ->assertJsonPath('data.updated_by.id', $user->getKey());

    expect($event->fresh()->form_schema)->toHaveCount(2);
    $audit = AuditLog::query()->where('action', 'event.updated')->firstOrFail();
    expect($audit->changes['fields'])->toContain('title', 'description')->not->toContain('excerpt', 'updated_by');
});

it('um PATCH vazio não muda nem audita nada', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();

    patchJson("/api/admin/events/{$event->getKey()}", [])->assertOk();

    expect(AuditLog::query()->where('action', 'event.updated')->count())->toBe(0);
});

it('publica e despublica um evento, com auditoria e regeneração da página inicial', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['starts_at' => '2026-12-05 12:00:00', 'ends_at' => null]);
    EventBus::fake([PublicContentChanged::class]);

    patchJson("/api/admin/events/{$event->getKey()}", ['is_published' => true])
        ->assertOk()
        ->assertJsonPath('data.is_published', true)
        ->assertJsonPath('data.registration.state', 'INSCRICOES_ABERTAS');

    EventBus::assertDispatched(PublicContentChanged::class, fn (PublicContentChanged $e) => $e->snapshots === ['home']);
    expect(AuditLog::query()->where('action', 'event.published')->count())->toBe(1);

    patchJson("/api/admin/events/{$event->getKey()}", ['is_published' => true])->assertOk();
    expect(AuditLog::query()->where('action', 'event.published')->count())->toBe(1);

    patchJson("/api/admin/events/{$event->getKey()}", ['is_published' => false])
        ->assertOk()
        ->assertJsonPath('data.is_published', false)
        ->assertJsonPath('data.registration.state', 'RASCUNHO');
    expect(AuditLog::query()->where('action', 'event.unpublished')->count())->toBe(1);
    EventBus::assertDispatchedTimes(PublicContentChanged::class, 2);
});

it('BR-033 publica com o prazo vencido: a confirmação é da tela, o evento fica com inscrições encerradas', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['starts_at' => '2026-12-05 12:00:00', 'ends_at' => null, 'registration_deadline' => '2026-11-01 12:00:00']);

    patchJson("/api/admin/events/{$event->getKey()}", ['is_published' => true])
        ->assertOk()
        ->assertJsonPath('data.registration.state', 'INSCRICOES_ENCERRADAS');
});

it('criar já publicado conta como criação e publicação', function () {
    asStaff('COMUNICACAO');

    postJson('/api/admin/events', adminEventFields(['is_published' => true]))->assertCreated()->assertJsonPath('data.is_published', true);

    expect(AuditLog::query()->where('action', 'event.created')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'event.published')->count())->toBe(1);
});

it('editar um rascunho não regenera a página inicial', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();
    EventBus::fake([PublicContentChanged::class]);

    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'Só um rascunho'])->assertOk();

    EventBus::assertNotDispatched(PublicContentChanged::class);
});

it('editar um evento publicado regenera a página inicial', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['is_published' => true]);
    EventBus::fake([PublicContentChanged::class]);

    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'Publicado'])->assertOk();

    EventBus::assertDispatchedTimes(PublicContentChanged::class, 1);
});

it('"Encerrar inscrições" é registration_deadline = agora', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['is_published' => true, 'starts_at' => '2026-12-05 12:00:00', 'ends_at' => null, 'registration_deadline' => null]);

    getJson("/api/admin/events/{$event->getKey()}")->assertJsonPath('data.registration.state', 'INSCRICOES_ABERTAS');

    patchJson("/api/admin/events/{$event->getKey()}", ['registration_deadline' => now()->toIso8601String()])
        ->assertOk()
        ->assertJsonPath('data.registration.state', 'INSCRICOES_ENCERRADAS')
        ->assertJsonPath('data.registration.deadline', '2026-11-10T12:00:00Z');
});

/*
|--------------------------------------------------------------------------
| Estado derivado e lista
|--------------------------------------------------------------------------
*/

it('deriva o estado do evento da publicação, das datas, do prazo e das vagas', function () {
    asStaff('COMUNICACAO');
    $cases = [
        'RASCUNHO' => ['is_published' => false],
        'INSCRICOES_ABERTAS' => ['is_published' => true, 'starts_at' => '2026-12-05 12:00:00'],
        'INSCRICOES_ENCERRADAS por prazo' => ['is_published' => true, 'starts_at' => '2026-12-05 12:00:00', 'registration_deadline' => '2026-11-09 12:00:00'],
        'INSCRICOES_ENCERRADAS por início' => ['is_published' => true, 'starts_at' => '2026-11-10 11:00:00', 'ends_at' => '2026-11-10 18:00:00'],
        'REALIZADO' => ['is_published' => true, 'starts_at' => '2026-11-01 12:00:00', 'ends_at' => '2026-11-02 12:00:00'],
        'REALIZADO sem término' => ['is_published' => true, 'starts_at' => '2026-11-09 12:00:00', 'ends_at' => null],
    ];

    foreach ($cases as $label => $attributes) {
        $event = adminEvent(['ends_at' => null, ...$attributes]);
        $expected = explode(' ', $label)[0];

        getJson("/api/admin/events/{$event->getKey()}")->assertJsonPath('data.registration.state', $expected, "Estado de «{$label}»");
    }

    $full = adminEvent(['is_published' => true, 'starts_at' => '2026-12-05 12:00:00', 'ends_at' => null, 'max_spots' => 2]);
    adminEventRegistrations($full, 2);
    getJson("/api/admin/events/{$full->getKey()}")
        ->assertJsonPath('data.registration.state', 'INSCRICOES_ENCERRADAS')
        ->assertJsonPath('data.registration.spots_left', 0);
});

it('lista com paginação, o total de inscritos e o estado', function () {
    asStaff('COMUNICACAO');
    $first = adminEvent(['starts_at' => '2026-12-01 12:00:00']);
    adminEvent(['starts_at' => '2026-12-10 12:00:00']);
    adminEvent(['starts_at' => '2026-12-20 12:00:00']);
    adminEventRegistrations($first, 4);

    $response = getJson('/api/admin/events?per_page=2')->assertOk();

    $response->assertJsonCount(2, 'data')
        ->assertJsonPath('meta.total', 3)
        ->assertJsonPath('meta.per_page', 2)
        ->assertJsonPath('meta.last_page', 2)
        ->assertJsonPath('data.0.starts_at', '2026-12-20T12:00:00Z');

    $asc = getJson('/api/admin/events?sort=starts_at&per_page=10')->assertOk();
    expect($asc->json('data.0.id'))->toBe($first->getKey())
        ->and($asc->json('data.0.registrations_count'))->toBe(4);
});

it('filtra a lista por estado e por ministério', function () {
    asStaff('COMUNICACAO');
    $ministry = MinistryGroup::factory()->create();
    $draft = adminEvent(['ministry_id' => $ministry->getKey()]);
    $open = adminEvent(['is_published' => true, 'starts_at' => '2026-12-05 12:00:00']);
    $held = adminEvent(['is_published' => true, 'starts_at' => '2026-10-01 12:00:00', 'ends_at' => null]);
    $closed = adminEvent(['is_published' => true, 'starts_at' => '2026-12-05 12:00:00', 'registration_deadline' => '2026-11-01 00:00:00']);
    $full = adminEvent(['is_published' => true, 'starts_at' => '2026-12-05 12:00:00', 'max_spots' => 1]);
    adminEventRegistrations($full, 1);

    $ids = fn (string $query): array => collect(getJson("/api/admin/events?{$query}")->assertOk()->json('data'))->pluck('id')->sort()->values()->all();

    expect($ids('state=RASCUNHO'))->toBe([$draft->getKey()])
        ->and($ids('state=INSCRICOES_ABERTAS'))->toBe([$open->getKey()])
        ->and($ids('state=REALIZADO'))->toBe([$held->getKey()])
        ->and($ids('state=INSCRICOES_ENCERRADAS'))->toBe([$closed->getKey(), $full->getKey()])
        ->and($ids("ministry_id={$ministry->getKey()}"))->toBe([$draft->getKey()]);

    getJson('/api/admin/events?state=QUALQUER')->assertUnprocessable()->assertFieldErrors(['state']);
});

/*
|--------------------------------------------------------------------------
| BR-030 e BR-075: escopo do próprio ministério
|--------------------------------------------------------------------------
*/

it('BR-030 o líder (.own) lista só os eventos do próprio ministério', function () {
    $leader = asStaff('LIDER_MINISTERIO');
    $mine = adminEvent(['ministry_id' => $leader->ministry_id]);
    adminEvent();

    $response = getJson('/api/admin/events')->assertOk();

    expect(array_column($response->json('data'), 'id'))->toBe([$mine->getKey()]);
    $response->assertJsonPath('meta.total', 1);
});

it('BR-030 o filtro por ministério não deixa o líder ver o de outro', function () {
    $leader = asStaff('LIDER_MINISTERIO');
    $other = adminEvent();
    $mine = adminEvent(['ministry_id' => $leader->ministry_id]);

    $response = getJson("/api/admin/events?ministry_id={$other->ministry_id}")->assertOk();

    expect($response->json('data'))->toBe([])->and($mine->exists)->toBeTrue();
});

it('BR-030 evento de outro ministério aparece para o líder como inexistente, em toda rota', function () {
    asStaff('LIDER_MINISTERIO');
    $foreign = adminEvent(['title' => 'De outro ministério']);
    $url = "/api/admin/events/{$foreign->getKey()}";

    getJson($url)->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    patchJson($url, ['title' => 'Invadido'])->assertNotFound();
    deleteJson($url)->assertNotFound();
    postAdminEventBanner($foreign)->assertNotFound();
    deleteJson("{$url}/banner")->assertNotFound();

    expect($foreign->fresh()->title)->toBe('De outro ministério');
});

it('o líder cria, edita, publica e exclui eventos do próprio ministério', function () {
    $leader = asStaff('LIDER_MINISTERIO');

    $id = postJson('/api/admin/events', adminEventFields(['ministry_id' => $leader->ministry_id]))->assertCreated()->json('data.id');

    patchJson("/api/admin/events/{$id}", ['title' => 'Renomeado', 'is_published' => true])->assertOk()->assertJsonPath('data.title', 'Renomeado');
    getJson("/api/admin/events/{$id}")->assertOk();
    deleteJson("/api/admin/events/{$id}")->assertNoContent();
});

it('BR-030 o líder não cria evento para outro ministério, nem muda o evento para outro', function () {
    $leader = asStaff('LIDER_MINISTERIO');
    $otherMinistry = MinistryGroup::factory()->create();

    postJson('/api/admin/events', adminEventFields(['ministry_id' => $otherMinistry->getKey()]))->assertForbidden();

    $mine = adminEvent(['ministry_id' => $leader->ministry_id]);
    patchJson("/api/admin/events/{$mine->getKey()}", ['ministry_id' => $otherMinistry->getKey()])->assertForbidden();

    expect($mine->fresh()->ministry_id)->toBe($leader->ministry_id)->and(Event::query()->count())->toBe(1);
});

it('a Comunicação (todos) cria e muda o ministério de qualquer evento', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();
    $ministry = MinistryGroup::factory()->create();

    patchJson("/api/admin/events/{$event->getKey()}", ['ministry_id' => $ministry->getKey()])
        ->assertOk()
        ->assertJsonPath('data.ministry.id', $ministry->getKey());
});

it('BR-075 líder sem ministério vinculado não recebe acesso nenhum', function () {
    asStaff('LIDER_MINISTERIO', ['ministry_id' => null]);
    $event = adminEvent();

    getJson('/api/admin/events')->assertForbidden();
    postJson('/api/admin/events', adminEventFields())->assertForbidden();
    getJson("/api/admin/events/{$event->getKey()}")->assertForbidden();
    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'X'])->assertForbidden();
    deleteJson("/api/admin/events/{$event->getKey()}")->assertForbidden();
});

it('quem não tem permissão de eventos recebe 403', function (string $role) {
    asStaff($role);
    $event = adminEvent();

    getJson('/api/admin/events')->assertForbidden();
    postJson('/api/admin/events', adminEventFields())->assertForbidden();
    getJson("/api/admin/events/{$event->getKey()}")->assertForbidden();
    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'X'])->assertForbidden();
    deleteJson("/api/admin/events/{$event->getKey()}")->assertForbidden();
})->with(['TESOURARIA', 'ORACAO', 'PASTORAL', 'ADMIN_TECNICO']);

it('a Secretaria, que só lê inscritos, vê a lista de todos os eventos mas não escreve', function () {
    asStaff('SECRETARIA');
    $event = adminEvent();

    getJson('/api/admin/events')->assertOk()->assertJsonPath('meta.total', 1);

    postJson('/api/admin/events', adminEventFields())->assertForbidden();
    getJson("/api/admin/events/{$event->getKey()}")->assertForbidden();
    patchJson("/api/admin/events/{$event->getKey()}", ['title' => 'X'])->assertForbidden();
    deleteJson("/api/admin/events/{$event->getKey()}")->assertForbidden();
    postAdminEventBanner($event)->assertForbidden();
});

it('sem sessão, 401', function () {
    getJson('/api/admin/events')->assertUnauthorized();
    postJson('/api/admin/events', adminEventFields())->assertUnauthorized();
});

/*
|--------------------------------------------------------------------------
| BR-045: banner
|--------------------------------------------------------------------------
*/

it('BR-045 grava o banner em WebP de 1600 px e de 800 px, sem EXIF', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();

    $response = postAdminEventBanner($event, adminEventImage('foto.jpg', 3000, 1500))->assertOk();

    expect($response->json('data.banner_url'))->toMatch('#^/uploads/eventos/\d{4}/[0-9a-f]{32}\.webp$#')
        ->and($response->json('data.banner_small_url'))->toMatch('#^/uploads/eventos/\d{4}/[0-9a-f]{32}-800\.webp$#')
        ->and(adminEventStoredWidths())->toBe([800, 1600]);

    $event->refresh();
    expect($event->banner_path)->toBe(substr((string) $response->json('data.banner_url'), strlen('/uploads/')));

    getJson("/api/admin/events/{$event->getKey()}")
        ->assertJsonPath('data.banner_url', $response->json('data.banner_url'))
        ->assertJsonPath('data.banner_small_url', $response->json('data.banner_small_url'));
});

it('BR-045 não aumenta uma imagem pequena', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();

    postAdminEventBanner($event, adminEventImage('pequena.png', 600, 300))->assertOk();

    expect(adminEventStoredWidths())->toBe([600, 600]);
});

it('BR-045 trocar o banner apaga os arquivos antigos', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();
    $first = postAdminEventBanner($event)->json('data.banner_url');

    $second = postAdminEventBanner($event, adminEventImage('outro.png'))->assertOk()->json('data.banner_url');

    expect($second)->not->toBe($first)
        ->and(Storage::disk('uploads')->allFiles())->toHaveCount(2)
        ->and(Storage::disk('uploads')->exists(substr((string) $first, strlen('/uploads/'))))->toBeFalse();
});

it('BR-045 recusa o que não é JPEG, PNG ou WebP verdadeiro', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();

    postAdminEventBanner($event, UploadedFile::fake()->createWithContent('banner.png', '<?php echo 1;')->mimeType('image/png'))
        ->assertUnprocessable()
        ->assertFieldError('banner', 'A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.');

    postAdminEventBanner($event, bulletinPdfUpload())->assertUnprocessable()->assertFieldErrors(['banner']);

    expect(Storage::disk('uploads')->allFiles())->toBe([])->and($event->fresh()->banner_path)->toBeNull();
});

it('BR-045 exige o arquivo e recusa mais de 3 MB com 413', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();

    test()->post("/api/admin/events/{$event->getKey()}/banner", [], ['Accept' => 'application/json'])
        ->assertUnprocessable()
        ->assertFieldErrors(['banner']);

    postAdminEventBanner($event, UploadedFile::fake()->image('enorme.png', 100, 100)->size(3 * 1024 + 1))
        ->assertStatus(413)
        ->assertJsonPath('error.code', 'PAYLOAD_TOO_LARGE');

    expect(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('remove o banner e apaga os dois arquivos; remover de novo é inofensivo', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent();
    postAdminEventBanner($event)->assertOk();

    deleteJson("/api/admin/events/{$event->getKey()}/banner")->assertNoContent();

    expect(Storage::disk('uploads')->allFiles())->toBe([])->and($event->fresh()->banner_path)->toBeNull();

    deleteJson("/api/admin/events/{$event->getKey()}/banner")->assertNoContent();
});

it('o banner de um evento publicado regenera a página inicial', function () {
    asStaff('COMUNICACAO');
    $event = adminEvent(['is_published' => true]);
    EventBus::fake([PublicContentChanged::class]);

    postAdminEventBanner($event)->assertOk();
    deleteJson("/api/admin/events/{$event->getKey()}/banner")->assertNoContent();

    EventBus::assertDispatchedTimes(PublicContentChanged::class, 2);
});

it('não expõe o endereço residencial do ministério, nem o e-mail de contato (BR-048, BR-050)', function () {
    asStaff('COMUNICACAO');
    $ministry = MinistryGroup::factory()->create(['private_address' => 'Rua Secreta, 1', 'contact_email' => 'segredo@example.com']);
    $event = adminEvent(['ministry_id' => $ministry->getKey()]);

    $body = getJson("/api/admin/events/{$event->getKey()}")->assertOk()->getContent();

    expect($body)->not->toContain('Rua Secreta')->not->toContain('segredo@example.com');
});
