<?php

declare(strict_types=1);

use App\Modules\Content\Models\Bulletin;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\post;

/*
| Painel de boletins (T107): POST/PATCH/DELETE /api/admin/bulletins e POST …/pdf (contracts/openapi.yaml).
| BR-040 (edição única), BR-041 (PDF verdadeiro até 10 MB), BR-042 (agendado fica invisível).
*/

beforeEach(function () {
    Storage::fake('uploads');
    asStaff('COMUNICACAO');
});

/** @return array<string, mixed> */
function bulletinFields(array $overrides = []): array
{
    return [
        'edition_number' => 1234,
        'reference_date' => '2026-11-08',
        'title' => 'Boletim de novembro',
        'summary_text' => 'Resumo da semana.',
        ...$overrides,
    ];
}

/** POST multipart, como o painel envia. */
function postBulletin(array $fields, ?UploadedFile $pdf = null): TestResponse
{
    return test()->post('/api/admin/bulletins', [...$fields, 'pdf' => $pdf ?? bulletinPdfUpload()], ['Accept' => 'application/json']);
}

it('cadastra o boletim com o PDF e responde 201 no formato BulletinAdmin', function () {
    $response = postBulletin(bulletinFields())->assertCreated();

    $response->assertJsonPath('data.edition_number', 1234)
        ->assertJsonPath('data.reference_date', '2026-11-08')
        ->assertJsonPath('data.title', 'Boletim de novembro')
        ->assertJsonPath('data.summary_text', 'Resumo da semana.')
        ->assertJsonPath('data.status', 'PUBLICADO');

    $url = $response->json('data.pdf_url');
    expect($url)->toMatch('#^/uploads/boletins/\d{4}/[0-9a-f]{32}\.pdf$#')
        ->and($response->json('data.pdf_size_bytes'))->toBeGreaterThan(0)
        ->and($response->json('data.updated_by.name'))->not->toBeNull();

    Storage::disk('uploads')->assertExists(substr((string) $url, strlen('/uploads/')));
});

it('BR-040 recusa uma edição que já existe entre os boletins não excluídos', function () {
    Bulletin::factory()->create(['edition_number' => 1234]);

    postBulletin(bulletinFields())
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'DUPLICATE_EDITION')
        ->assertJsonPath('error.message', 'Já existe um boletim com a edição 1234.');

    expect(Bulletin::query()->count())->toBe(1)
        ->and(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('BR-040 libera a edição de um boletim excluído', function () {
    Bulletin::factory()->trashed()->create(['edition_number' => 1234]);

    postBulletin(bulletinFields())->assertCreated();

    expect(Bulletin::query()->where('edition_number', 1234)->count())->toBe(1);
});

it('BR-040 recusa mudar a edição para uma que já existe, mas aceita manter a própria', function () {
    $taken = Bulletin::factory()->create(['edition_number' => 10]);
    $mine = Bulletin::factory()->create(['edition_number' => 11]);

    patchJson("/api/admin/bulletins/{$mine->getKey()}", ['edition_number' => 10])
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'DUPLICATE_EDITION');

    patchJson("/api/admin/bulletins/{$mine->getKey()}", ['edition_number' => 11, 'title' => 'Novo título'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Novo título');

    expect($taken->refresh()->edition_number)->toBe(10);
});

it('BR-041 aceita um PDF de até 10 MB', function () {
    $padding = 10 * 1024 * 1024 - 300;

    postBulletin(bulletinFields(), bulletinPdfUpload('grande.pdf', $padding))
        ->assertCreated()
        ->assertJsonPath('data.pdf_size_bytes', fn (int $size) => $size > 10 * 1024 * 1024 - 400 && $size <= 10 * 1024 * 1024);
});

it('BR-041 responde 413 para um PDF acima de 10 MB', function () {
    // 10.241 KB = 10 MB + 1 KB; o tamanho é conferido antes de ler o conteúdo
    postBulletin(bulletinFields(), UploadedFile::fake()->create('enorme.pdf', 10_241, 'application/pdf'))
        ->assertStatus(413)
        ->assertJsonPath('error.code', 'PAYLOAD_TOO_LARGE');

    expect(Bulletin::query()->count())->toBe(0)
        ->and(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('BR-041 responde 422 para um arquivo que só tem a extensão .pdf', function () {
    $fake = UploadedFile::fake()->createWithContent('falso.pdf', "isto é um texto, não um PDF\n")->mimeType('application/pdf');

    postBulletin(bulletinFields(), $fake)
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'pdf')
        ->assertJsonPath('error.details.0.message', 'O arquivo precisa ser um PDF.');

    expect(Bulletin::query()->count())->toBe(0);
});

it('BR-041 responde 422 para um PDF com tag PHP escondida', function () {
    $polyglot = UploadedFile::fake()->createWithContent('truque.pdf', "%PDF-1.4\n<?php system(\$_GET['x']); ?>\n%%EOF\n")->mimeType('application/pdf');

    postBulletin(bulletinFields(), $polyglot)->assertStatus(422)->assertJsonPath('error.details.0.field', 'pdf');

    expect(Bulletin::query()->count())->toBe(0);
});

it('valida os campos do cadastro com 422 e o campo no envelope', function (array $override, string $field) {
    postBulletin(bulletinFields($override))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonFragment(['field' => $field]);
})->with([
    'edição zero' => [['edition_number' => 0], 'edition_number'],
    'edição sem número' => [['edition_number' => 'abc'], 'edition_number'],
    'data de referência inválida' => [['reference_date' => '08/11/2026'], 'reference_date'],
    'título curto' => [['title' => 'ab'], 'title'],
    'título comprido' => [['title' => str_repeat('a', 151)], 'title'],
    'resumo comprido' => [['summary_text' => str_repeat('a', 5001)], 'summary_text'],
    'publicação inválida' => [['published_at' => 'amanhã'], 'published_at'],
]);

it('exige o PDF no cadastro', function () {
    test()->postJson('/api/admin/bulletins', bulletinFields())
        ->assertStatus(422)
        ->assertJsonFragment(['field' => 'pdf']);
});

it('BR-042 um boletim agendado fica fora da API pública e aparece no painel como AGENDADO', function () {
    $future = now()->addDays(5)->utc()->format('Y-m-d\TH:i:s\Z');

    $id = postBulletin(bulletinFields(['published_at' => $future]))
        ->assertCreated()
        ->assertJsonPath('data.status', 'AGENDADO')
        ->json('data.id');

    getJson('/api/public/bulletins')->assertOk()->assertJsonCount(0, 'data');
    getJson('/api/admin/bulletins')->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.status', 'AGENDADO');
});

it('BR-042 interpreta o horário sem fuso como o de Brasília e guarda em UTC', function () {
    $id = postBulletin(bulletinFields(['published_at' => '2030-03-10T09:00']))->assertCreated()->json('data.id');

    expect(Bulletin::query()->findOrFail($id)->published_at->utc()->format('Y-m-d H:i'))->toBe('2030-03-10 12:00');
});

it('substitui o PDF e apaga o arquivo anterior do disco', function () {
    $created = postBulletin(bulletinFields())->assertCreated();
    $id = $created->json('data.id');
    $oldPath = substr((string) $created->json('data.pdf_url'), strlen('/uploads/'));

    $response = post("/api/admin/bulletins/{$id}/pdf", ['pdf' => bulletinPdfUpload('novo.pdf', 5000)], ['Accept' => 'application/json'])
        ->assertOk();

    $newPath = substr((string) $response->json('data.pdf_url'), strlen('/uploads/'));

    expect($newPath)->not->toBe($oldPath)
        ->and($response->json('data.pdf_size_bytes'))->toBeGreaterThan(5000);
    Storage::disk('uploads')->assertMissing($oldPath);
    Storage::disk('uploads')->assertExists($newPath);
});

it('BR-041 uma troca recusada mantém o PDF antigo', function () {
    $created = postBulletin(bulletinFields())->assertCreated();
    $id = $created->json('data.id');
    $oldPath = substr((string) $created->json('data.pdf_url'), strlen('/uploads/'));

    $fake = UploadedFile::fake()->createWithContent('falso.pdf', 'não é PDF')->mimeType('application/pdf');
    post("/api/admin/bulletins/{$id}/pdf", ['pdf' => $fake], ['Accept' => 'application/json'])->assertStatus(422);

    Storage::disk('uploads')->assertExists($oldPath);
    expect(Bulletin::query()->findOrFail($id)->pdf_path)->toBe($oldPath);
});

it('exclui logicamente: sai das listas, o registro e o PDF ficam, e a edição fica livre', function () {
    $created = postBulletin(bulletinFields())->assertCreated();
    $id = $created->json('data.id');
    $path = substr((string) $created->json('data.pdf_url'), strlen('/uploads/'));

    deleteJson("/api/admin/bulletins/{$id}")->assertNoContent();

    getJson('/api/admin/bulletins')->assertOk()->assertJsonCount(0, 'data');
    getJson('/api/public/bulletins')->assertOk()->assertJsonCount(0, 'data');
    expect(Bulletin::withTrashed()->find($id)?->deleted_at)->not->toBeNull();
    Storage::disk('uploads')->assertExists($path);

    postBulletin(bulletinFields())->assertCreated();
});

it('mostra um boletim para editar, inclusive o agendado', function () {
    $scheduled = Bulletin::factory()->scheduled()->create(['edition_number' => 77, 'title' => 'Boletim agendado']);

    getJson("/api/admin/bulletins/{$scheduled->getKey()}")
        ->assertOk()
        ->assertJsonPath('data.edition_number', 77)
        ->assertJsonPath('data.status', 'AGENDADO')
        ->assertJsonPath('data.pdf_url', '/uploads/'.$scheduled->pdf_path);
});

it('responde 404 ao mostrar, alterar ou excluir um boletim que não existe ou já foi excluído', function () {
    $trashed = Bulletin::factory()->trashed()->create();

    getJson('/api/admin/bulletins/999999')->assertNotFound();
    getJson("/api/admin/bulletins/{$trashed->getKey()}")->assertNotFound();
    patchJson('/api/admin/bulletins/999999', ['title' => 'Qualquer um'])->assertNotFound();
    patchJson("/api/admin/bulletins/{$trashed->getKey()}", ['title' => 'Qualquer um'])->assertNotFound();
    deleteJson("/api/admin/bulletins/{$trashed->getKey()}")->assertNotFound();
});

it('toda alteração pede a regeneração dos snapshots da home', function () {
    Event::fake([PublicContentChanged::class]);

    $id = postBulletin(bulletinFields())->assertCreated()->json('data.id');
    patchJson("/api/admin/bulletins/{$id}", ['title' => 'Outro título'])->assertOk();
    post("/api/admin/bulletins/{$id}/pdf", ['pdf' => bulletinPdfUpload()], ['Accept' => 'application/json'])->assertOk();
    deleteJson("/api/admin/bulletins/{$id}")->assertNoContent();

    Event::assertDispatchedTimes(PublicContentChanged::class, 4);
    Event::assertDispatched(PublicContentChanged::class, fn (PublicContentChanged $event) => $event->snapshots === ['home']);
});

it('audita criar, alterar, trocar o PDF e excluir, sem dado pessoal', function () {
    $id = postBulletin(bulletinFields())->assertCreated()->json('data.id');
    patchJson("/api/admin/bulletins/{$id}", ['title' => 'Outro título'])->assertOk();
    post("/api/admin/bulletins/{$id}/pdf", ['pdf' => bulletinPdfUpload()], ['Accept' => 'application/json'])->assertOk();
    deleteJson("/api/admin/bulletins/{$id}")->assertNoContent();

    $actions = AuditLog::query()->where('resource_type', 'bulletin')->where('resource_id', (string) $id)->orderBy('id')->pluck('action')->all();

    expect($actions)->toBe(['bulletin.created', 'bulletin.updated', 'bulletin.pdf_replaced', 'bulletin.deleted']);

    $updated = AuditLog::query()->where('action', 'bulletin.updated')->firstOrFail();
    expect($updated->changes['fields'])->toBe(['title'])
        ->and($updated->actor_user_id)->not->toBeNull();
});

it('lista os boletins do painel com filtros de ano e de estado e ordenação', function () {
    Bulletin::factory()->create(['edition_number' => 1, 'reference_date' => '2025-03-02', 'published_at' => now()->subYear()]);
    Bulletin::factory()->create(['edition_number' => 2, 'reference_date' => '2026-03-02', 'published_at' => now()->subMonth()]);
    Bulletin::factory()->scheduled()->create(['edition_number' => 3, 'reference_date' => '2026-04-02']);

    getJson('/api/admin/bulletins')->assertOk()
        ->assertJsonPath('data.0.edition_number', 3)->assertJsonPath('data.2.edition_number', 1)
        ->assertJsonPath('meta.total', 3);
    getJson('/api/admin/bulletins?year=2025')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.edition_number', 1);
    getJson('/api/admin/bulletins?status=AGENDADO')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.edition_number', 3);
    getJson('/api/admin/bulletins?status=PUBLICADO&sort=-edition_number')->assertOk()->assertJsonPath('data.0.edition_number', 2);
    getJson('/api/admin/bulletins?status=NADA')->assertStatus(422);
});

it('BR-076 só quem tem boletins.write mexe nos boletins', function (string $role, int $status) {
    auth()->logout();
    asStaff($role);

    getJson('/api/admin/bulletins')->assertStatus($status);
    test()->postJson('/api/admin/bulletins', [])->assertStatus($status === 200 ? 422 : $status);
})->with([
    'Comunicação' => ['COMUNICACAO', 200],
    'Administrador técnico (só lê usuários)' => ['ADMIN_TECNICO', 403],
    'Secretaria' => ['SECRETARIA', 403],
    'Tesouraria' => ['TESOURARIA', 403],
    'Oração' => ['ORACAO', 403],
    'Pastoral' => ['PASTORAL', 403],
    'Líder de ministério' => ['LIDER_MINISTERIO', 403],
]);

it('responde 401 sem sessão', function () {
    auth()->logout();
    test()->flushSession();

    getJson('/api/admin/bulletins')->assertUnauthorized();
});
