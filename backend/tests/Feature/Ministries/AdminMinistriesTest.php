<?php

declare(strict_types=1);

use App\Modules\Events\Models\Event;
use App\Modules\Leads\Models\Lead;
use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Ministries\Snapshots\MinistriesSnapshot;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Facades\Event as EventBus;
use Illuminate\Testing\TestResponse;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

/*
| /api/admin/ministries (T134; CAP-16, contracts/openapi.yaml). BR-047 (ITEM_IN_USE), BR-048 (campos internos só no
| painel), BR-049 (dia e horário; bairro), item inativo fora do público, auditoria e snapshot.
*/

beforeEach(function () {
    MinistryGroup::query()->delete();
    $this->operator = asStaff('SECRETARIA', ['name' => 'Sara Secretária']);
});

/** @return array<string, mixed> */
function ministryBody(array $overrides = []): array
{
    return $overrides + ['category' => 'MINISTERIO', 'name' => 'Ministério de Música'];
}

function storeMinistry(array $overrides = []): TestResponse
{
    return postJson('/api/admin/ministries', ministryBody($overrides));
}

describe('GET /api/admin/ministries', function () {
    it('BR-048 lista com private_address e contact_email, que o público nunca vê', function () {
        MinistryGroup::factory()->cell()->create(['name' => 'Célula Promissão', 'private_address' => 'Rua Secreta, 77', 'contact_email' => 'celula@example.com']);

        $item = getJson('/api/admin/ministries')->assertOk()->json('data.0');

        expect($item)->toMatchArray(['name' => 'Célula Promissão', 'private_address' => 'Rua Secreta, 77', 'contact_email' => 'celula@example.com']);
        expect(json_encode(getJson('/api/public/ministries')->json()))->not->toContain('Rua Secreta')->not->toContain('celula@example.com');
    });

    it('lista também os inativos, por ordem de exibição e depois por nome', function () {
        MinistryGroup::factory()->create(['name' => 'Zeta', 'display_order' => 1]);
        MinistryGroup::factory()->inactive()->create(['name' => 'Desativado', 'display_order' => 0]);
        MinistryGroup::factory()->create(['name' => 'Beta', 'display_order' => 2]);

        getJson('/api/admin/ministries')->assertOk()
            ->assertJson(['data' => [['name' => 'Desativado', 'is_active' => false], ['name' => 'Zeta'], ['name' => 'Beta']]]);
    });

    it('filtra por categoria, estado e parte do nome', function () {
        MinistryGroup::factory()->create(['name' => 'Música']);
        MinistryGroup::factory()->group()->create(['name' => 'Homens']);
        MinistryGroup::factory()->group()->inactive()->create(['name' => 'Mulheres']);

        getJson('/api/admin/ministries?category=GRUPO')->assertJsonCount(2, 'data');
        getJson('/api/admin/ministries?is_active=false')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Mulheres');
        getJson('/api/admin/ministries?q=mus')->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Música');
        getJson('/api/admin/ministries?q=%25')->assertJsonCount(0, 'data');
    });

    it('mostra quem alterou por último', function () {
        $ministry = MinistryGroup::factory()->create(['updated_by' => $this->operator->getKey()]);

        getJson("/api/admin/ministries/{$ministry->getKey()}")->assertOk()
            ->assertJsonPath('data.updated_by', ['id' => $this->operator->getKey(), 'name' => 'Sara Secretária']);
    });

    it('responde 404 para um item que não existe', function () {
        getJson('/api/admin/ministries/999999')->assertNotFound();
    });
});

describe('POST /api/admin/ministries', function () {
    it('cadastra cada tipo de item e devolve o que só o painel vê', function (array $body) {
        $response = storeMinistry($body)->assertCreated();

        expect($response->json('data'))->toMatchArray($body)->and($response->json('data.is_active'))->toBeTrue();
        expect(MinistryGroup::query()->count())->toBe(1);
    })->with([
        'ministério' => [['category' => 'MINISTERIO', 'name' => 'Cantina']],
        'grupo' => [['category' => 'GRUPO', 'name' => 'Homens', 'schedule_text' => 'Último sábado do mês, 20h']],
        'célula' => [['category' => 'CELULA', 'name' => 'Célula Centro', 'schedule_text' => 'Terças, 20h', 'neighborhood' => 'Centro', 'private_address' => 'Rua A, 10', 'contact_email' => 'celula@example.com']],
    ]);

    it('BR-049 grupo e célula pedem dia e horário', function (string $category) {
        storeMinistry(['category' => $category, 'neighborhood' => 'Centro'])
            ->assertUnprocessable()
            ->assertFieldError('schedule_text', 'Informe dia e horário.');

        storeMinistry(['category' => $category, 'neighborhood' => 'Centro', 'schedule_text' => '   '])
            ->assertUnprocessable()
            ->assertFieldError('schedule_text', 'Informe dia e horário.');
    })->with(['GRUPO', 'CELULA']);

    it('BR-049 a célula pede o bairro, o grupo não', function () {
        storeMinistry(['category' => 'CELULA', 'schedule_text' => 'Terças, 20h'])
            ->assertUnprocessable()
            ->assertFieldError('neighborhood', 'Informe o bairro.');

        storeMinistry(['category' => 'GRUPO', 'schedule_text' => 'Terças, 20h'])->assertCreated();
    });

    it('BR-049 um ministério não pede nada além do nome', function () {
        storeMinistry(['category' => 'MINISTERIO'])->assertCreated();
    });

    it('o item novo vai para o fim da lista, a menos que a ordem seja informada', function () {
        MinistryGroup::factory()->create(['display_order' => 7]);

        storeMinistry(['name' => 'Último'])->assertCreated()->assertJsonPath('data.display_order', 8);
        storeMinistry(['name' => 'Primeiro', 'display_order' => 0])->assertCreated()->assertJsonPath('data.display_order', 0);
    });

    it('valida nome, categoria, telefone, e-mail e ordem', function () {
        storeMinistry(['category' => 'OUTRO', 'name' => 'A', 'contact_phone' => '123', 'contact_email' => 'sem-arroba', 'display_order' => -1])
            ->assertUnprocessable()
            ->assertFieldErrors(['category', 'name', 'contact_phone', 'contact_email', 'display_order']);

        storeMinistry(['name' => str_repeat('a', 121)])->assertUnprocessable()->assertFieldErrors(['name']);
        storeMinistry(['leaders_text' => str_repeat('a', 501)])->assertUnprocessable()->assertFieldErrors(['leaders_text']);
        expect(MinistryGroup::query()->count())->toBe(0);
    });

    it('guarda o telefone em E.164 e o e-mail em minúsculas', function () {
        $data = storeMinistry(['contact_phone' => '(31) 99123-4567', 'contact_email' => 'Contato@Example.com'])->assertCreated()->json('data');

        expect($data['contact_phone'])->toBe('+5531991234567')->and($data['contact_email'])->toBe('contato@example.com');
    });

    it('BR-046 sanitiza a descrição no servidor', function () {
        $description = storeMinistry(['description' => '<p>Louvor <strong>e adoração</strong></p><script>alert(1)</script><img src=x onerror=alert(2)>'])
            ->assertCreated()->json('data.description');

        expect($description)->toContain('<strong>e adoração</strong>')->not->toContain('<script')->not->toContain('onerror')->not->toContain('<img');
    });

    it('limita a descrição a 5.000 caracteres de texto', function () {
        storeMinistry(['description' => '<p>'.str_repeat('a', 5001).'</p>'])
            ->assertUnprocessable()
            ->assertFieldError('description', 'A descrição pode ter no máximo 5.000 caracteres.');

        storeMinistry(['description' => '<p>'.str_repeat('a', 5000).'</p>'])->assertCreated();
    });
});

describe('PATCH /api/admin/ministries/{id}', function () {
    it('altera só os campos enviados', function () {
        $ministry = MinistryGroup::factory()->create(['name' => 'Antigo', 'leaders_text' => 'Coordenador: Ana']);

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['name' => 'Novo'])
            ->assertOk()
            ->assertJsonPath('data.name', 'Novo')
            ->assertJsonPath('data.leaders_text', 'Coordenador: Ana')
            ->assertJsonPath('data.updated_by.name', 'Sara Secretária');
    });

    it('desativa e reativa, e o item inativo some do público e dos formulários', function () {
        $ministry = MinistryGroup::factory()->create(['name' => 'Cantina']);
        getJson('/api/public/ministries')->assertJsonCount(1, 'data');

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['is_active' => false])->assertOk()->assertJsonPath('data.is_active', false);
        getJson('/api/public/ministries')->assertJsonCount(0, 'data');
        expect(app(MinistriesSnapshot::class)->build())->toBe([]);

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['is_active' => true])->assertOk();
        getJson('/api/public/ministries')->assertJsonCount(1, 'data');
    });

    it('reordena', function () {
        $first = MinistryGroup::factory()->create(['name' => 'Alfa', 'display_order' => 1]);
        $second = MinistryGroup::factory()->create(['name' => 'Beta', 'display_order' => 2]);

        patchJson("/api/admin/ministries/{$second->getKey()}", ['display_order' => 0])->assertOk();

        expect(collect(getJson('/api/public/ministries')->json('data'))->pluck('name')->all())->toBe(['Beta', 'Alfa']);
        expect($first->refresh()->display_order)->toBe(1);
    });

    it('BR-049 vale para o item inteiro: virar grupo sem horário é recusado', function () {
        $ministry = MinistryGroup::factory()->create(['schedule_text' => null]);

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['category' => 'GRUPO'])
            ->assertUnprocessable()
            ->assertFieldError('schedule_text', 'Informe dia e horário.');
        expect($ministry->refresh()->category)->toBe('MINISTERIO');

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['category' => 'GRUPO', 'schedule_text' => 'Sábados, 20h'])->assertOk();
    });

    it('BR-049 apagar o bairro de uma célula é recusado', function () {
        $cell = MinistryGroup::factory()->cell()->create();

        patchJson("/api/admin/ministries/{$cell->getKey()}", ['neighborhood' => null])
            ->assertUnprocessable()
            ->assertFieldError('neighborhood', 'Informe o bairro.');
    });

    it('apaga um campo opcional enviando null', function () {
        $ministry = MinistryGroup::factory()->create(['contact_email' => 'a@example.com', 'private_address' => 'Rua X']);

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['contact_email' => null, 'private_address' => null])
            ->assertOk()
            ->assertJsonPath('data.contact_email', null)
            ->assertJsonPath('data.private_address', null);
    });

    it('responde 404 para um item que não existe', function () {
        patchJson('/api/admin/ministries/999999', ['name' => 'Qualquer'])->assertNotFound();
    });
});

describe('DELETE /api/admin/ministries/{id}', function () {
    it('exclui um item sem vínculos', function () {
        $ministry = MinistryGroup::factory()->create();

        deleteJson("/api/admin/ministries/{$ministry->getKey()}")->assertNoContent();

        expect(MinistryGroup::query()->whereKey($ministry->getKey())->exists())->toBeFalse();
    });

    it('BR-047 recusa com ITEM_IN_USE quando há vínculo, e o item continua lá', function (Closure $link) {
        $ministry = MinistryGroup::factory()->create();
        $link($ministry);

        deleteJson("/api/admin/ministries/{$ministry->getKey()}")
            ->assertConflict()
            ->assertJsonPath('error.code', 'ITEM_IN_USE')
            ->assertJsonPath('error.message', 'Este item está vinculado a eventos, contatos ou usuários. Desative-o em vez de excluir.');

        expect(MinistryGroup::query()->whereKey($ministry->getKey())->exists())->toBeTrue();
    })->with([
        'usuário do painel' => [fn (MinistryGroup $m) => userWithRole('LIDER_MINISTERIO', ['ministry_id' => $m->getKey()])],
        'contato' => [fn (MinistryGroup $m) => Lead::factory()->create(['type' => 'MINISTERIO', 'ministry_id' => $m->getKey()])],
        'evento' => [fn (MinistryGroup $m) => Event::factory()->create(['ministry_id' => $m->getKey()])],
    ]);

    it('BR-047 desativar em vez de excluir continua possível para um item em uso', function () {
        $ministry = MinistryGroup::factory()->create();
        userWithRole('LIDER_MINISTERIO', ['ministry_id' => $ministry->getKey()]);

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['is_active' => false])->assertOk();
    });

    it('responde 404 para um item que não existe', function () {
        deleteJson('/api/admin/ministries/999999')->assertNotFound();
    });
});

describe('auditoria e snapshot', function () {
    it('audita ministry.created, ministry.updated e ministry.deleted com o autor', function () {
        $id = storeMinistry(['name' => 'Cantina'])->assertCreated()->json('data.id');
        patchJson("/api/admin/ministries/{$id}", ['name' => 'Cantina da Igreja', 'is_active' => false])->assertOk();
        deleteJson("/api/admin/ministries/{$id}")->assertNoContent();

        $audits = AuditLog::query()->whereIn('action', ['ministry.created', 'ministry.updated', 'ministry.deleted'])->orderBy('id')->get();

        expect($audits->pluck('action')->all())->toBe(['ministry.created', 'ministry.updated', 'ministry.deleted'])
            ->and($audits->pluck('actor_user_id')->unique()->all())->toBe([$this->operator->getKey()])
            ->and($audits[1]->changes['fields'])->toEqualCanonicalizing(['name', 'is_active'])
            ->and($audits[1]->changes['after'])->toEqual(['label' => 'Cantina da Igreja', 'is_active' => false]);
    });

    it('a auditoria não leva endereço, telefone nem e-mail', function () {
        $id = storeMinistry(['category' => 'CELULA', 'name' => 'Célula Norte', 'schedule_text' => 'Terças, 20h', 'neighborhood' => 'Norte',
            'private_address' => 'Rua Secreta, 77', 'contact_phone' => '31991234567', 'contact_email' => 'celula@example.com'])->json('data.id');
        patchJson("/api/admin/ministries/{$id}", ['private_address' => 'Rua Nova, 1', 'contact_email' => 'outro@example.com'])->assertOk();

        $logged = AuditLog::query()->where('action', 'like', 'ministry.%')->get()->map(fn (AuditLog $log) => json_encode($log->changes))->implode(' ');

        expect($logged)->not->toContain('Secreta')->not->toContain('Rua Nova')->not->toContain('example.com')->not->toContain('99123');
    });

    it('cada mudança pede a regeneração do snapshot do catálogo', function () {
        EventBus::fake([PublicContentChanged::class]);

        $id = storeMinistry()->assertCreated()->json('data.id');
        patchJson("/api/admin/ministries/{$id}", ['name' => 'Outro nome'])->assertOk();
        deleteJson("/api/admin/ministries/{$id}")->assertNoContent();

        EventBus::assertDispatchedTimes(PublicContentChanged::class, 3);
        EventBus::assertDispatched(PublicContentChanged::class, fn (PublicContentChanged $event) => $event->snapshots === ['ministries']);
    });

    it('o mesmo valor não grava, não audita e não regenera o snapshot', function () {
        $ministry = MinistryGroup::factory()->create(['name' => 'Cantina']);
        EventBus::fake([PublicContentChanged::class]);

        patchJson("/api/admin/ministries/{$ministry->getKey()}", ['name' => 'Cantina'])->assertOk();

        expect(AuditLog::query()->where('action', 'ministry.updated')->count())->toBe(0);
        EventBus::assertNotDispatched(PublicContentChanged::class);
    });

    it('o snapshot do catálogo passa a mostrar o item novo, sem os campos internos', function () {
        storeMinistry(['name' => 'Cantina', 'contact_email' => 'cantina@example.com', 'private_address' => 'Rua A'])->assertCreated();

        $snapshot = app(MinistriesSnapshot::class)->build();

        expect(collect($snapshot)->pluck('name')->all())->toContain('Cantina')
            ->and(json_encode($snapshot))->not->toContain('cantina@example.com')->not->toContain('Rua A');
    });
});
