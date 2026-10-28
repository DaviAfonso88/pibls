<?php

declare(strict_types=1);

use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Facades\Event;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;

/*
| Palavra Viva, painel e público (T109; contracts/openapi.yaml).
| BR-032 (endereço único), BR-044 (só YouTube), BR-046 (sanitização e aviso), BR-042 (agendada fica invisível).
*/

/** @return array<string, mixed> */
function postFields(array $overrides = []): array
{
    return [
        'title' => 'A graça que sustenta',
        'slug' => 'a-graca-que-sustenta',
        'body' => '<p>Texto da <strong>mensagem</strong>.</p>',
        'author_display' => 'Pr. Fulano',
        ...$overrides,
    ];
}

describe('painel', function () {
    beforeEach(function () {
        asStaff('COMUNICACAO');
    });

    it('cria a mensagem, devolve 201 com o corpo sanitizado e gera o resumo', function () {
        $response = postJson('/api/admin/palavra-viva', postFields())->assertCreated();

        $response->assertJsonPath('data.slug', 'a-graca-que-sustenta')
            ->assertJsonPath('data.body', '<p>Texto da <strong>mensagem</strong>.</p>')
            ->assertJsonPath('data.excerpt', 'Texto da mensagem.')
            ->assertJsonPath('data.author_display', 'Pr. Fulano')
            ->assertJsonPath('data.status', 'PUBLICADO')
            ->assertJsonPath('data.youtube_video_id', null);

        expect($response->json())->not->toHaveKey('sanitization_warning');
    });

    it('BR-046 remove a marcação não permitida e avisa com sanitization_warning', function () {
        $response = postJson('/api/admin/palavra-viva', postFields([
            'body' => '<p onclick="x()">Olá</p><script>alert(1)</script><img src="https://x.test/a.png"><a href="javascript:alert(1)">link</a>',
        ]))->assertCreated();

        $body = (string) $response->json('data.body');

        expect($response->json('sanitization_warning'))->toBeTrue()
            ->and($body)->toContain('Olá')
            ->not->toContain('script')->not->toContain('onclick')->not->toContain('<img')->not->toContain('javascript:');
    });

    it('BR-046 o link permitido sai com rel noopener noreferrer e não gera aviso', function () {
        $response = postJson('/api/admin/palavra-viva', postFields([
            'body' => '<p>Veja <a href="https://example.com/x" target="_blank">aqui</a>.</p>',
        ]))->assertCreated();

        expect($response->json('data.body'))->toContain('<a href="https://example.com/x" rel="noopener noreferrer">aqui</a>')
            ->and($response->json())->not->toHaveKey('sanitization_warning');
    });

    it('BR-046 um corpo que só tinha marcação proibida vira 422', function () {
        postJson('/api/admin/palavra-viva', postFields(['body' => '<script>alert(1)</script>']))
            ->assertStatus(422)
            ->assertJsonFragment(['field' => 'body']);

        expect(PalavraVivaPost::query()->count())->toBe(0);
    });

    it('gera o resumo de até 300 caracteres do texto puro', function () {
        $long = '<p>'.str_repeat('Palavra ', 80).'</p>';

        $excerpt = (string) postJson('/api/admin/palavra-viva', postFields(['body' => $long]))->assertCreated()->json('data.excerpt');

        expect(mb_strlen($excerpt))->toBeLessThanOrEqual(300)->and($excerpt)->toEndWith('…')->not->toContain('<');
    });

    it('BR-032 recusa um endereço que já existe entre as mensagens não excluídas', function () {
        PalavraVivaPost::factory()->create(['slug' => 'a-graca-que-sustenta']);

        postJson('/api/admin/palavra-viva', postFields())
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'DUPLICATE_SLUG')
            ->assertJsonPath('error.message', 'Já existe um item com este endereço. Escolha outro.');
    });

    it('BR-032 libera o endereço de uma mensagem excluída', function () {
        PalavraVivaPost::factory()->trashed()->create(['slug' => 'a-graca-que-sustenta']);

        postJson('/api/admin/palavra-viva', postFields())->assertCreated();
    });

    it('BR-032 recusa trocar para um endereço de outra mensagem, mas aceita manter o próprio', function () {
        PalavraVivaPost::factory()->create(['slug' => 'ocupado']);
        $mine = PalavraVivaPost::factory()->create(['slug' => 'meu-endereco']);

        patchJson("/api/admin/palavra-viva/{$mine->getKey()}", ['slug' => 'ocupado'])
            ->assertStatus(409)->assertJsonPath('error.code', 'DUPLICATE_SLUG');
        patchJson("/api/admin/palavra-viva/{$mine->getKey()}", ['slug' => 'meu-endereco', 'title' => 'Novo título'])
            ->assertOk()->assertJsonPath('data.title', 'Novo título');
    });

    it('valida o formato do endereço e os demais campos com 422', function (array $override, string $field) {
        postJson('/api/admin/palavra-viva', postFields($override))
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonFragment(['field' => $field]);
    })->with([
        'endereço com maiúscula' => [['slug' => 'Graca'], 'slug'],
        'endereço com acento' => [['slug' => 'graça'], 'slug'],
        'endereço com espaço' => [['slug' => 'a graca'], 'slug'],
        'endereço com hífen duplo' => [['slug' => 'a--graca'], 'slug'],
        'endereço com hífen na ponta' => [['slug' => '-graca'], 'slug'],
        'endereço comprido' => [['slug' => str_repeat('a', 161)], 'slug'],
        'título curto' => [['title' => 'ab'], 'title'],
        'título comprido' => [['title' => str_repeat('a', 151)], 'title'],
        'corpo ausente' => [['body' => ''], 'body'],
        'corpo grande demais' => [['body' => str_repeat('a', 50_001)], 'body'],
        'autor comprido' => [['author_display' => str_repeat('a', 121)], 'author_display'],
        'publicação inválida' => [['published_at' => 'amanhã'], 'published_at'],
    ]);

    it('BR-044 aceita os formatos de link do YouTube e guarda o endereço canônico e o id do vídeo', function (string $link) {
        $data = postJson('/api/admin/palavra-viva', postFields(['youtube_url' => $link]))->assertCreated()->json('data');

        expect($data['youtube_video_id'])->toBe('dQw4w9WgXcQ')
            ->and($data['youtube_url'])->toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    })->with([
        'watch' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'watch com lista' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=10s',
        'sem www' => 'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'celular' => 'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
        'curto' => 'https://youtu.be/dQw4w9WgXcQ?si=abc',
        'embed' => 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        'shorts' => 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        'transmissão' => 'https://www.youtube.com/live/dQw4w9WgXcQ',
        'nocookie' => 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    ]);

    it('BR-044 recusa o que não é um vídeo do YouTube, com a mensagem da regra', function (string $link) {
        postJson('/api/admin/palavra-viva', postFields(['youtube_url' => $link]))
            ->assertStatus(422)
            ->assertJsonPath('error.details.0.field', 'youtube_url')
            ->assertJsonPath('error.details.0.message', 'Informe um link do YouTube.');

        expect(PalavraVivaPost::query()->count())->toBe(0);
    })->with([
        'outro site' => 'https://vimeo.com/123456789',
        'host parecido' => 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
        'sem protocolo' => 'www.youtube.com/watch?v=dQw4w9WgXcQ',
        'javascript' => 'javascript:alert(1)',
        'canal' => 'https://www.youtube.com/@pibls',
        'sem vídeo' => 'https://www.youtube.com/watch',
        'id curto' => 'https://youtu.be/abc',
        'com senha' => 'https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ',
        'texto' => 'não é um link',
    ]);

    it('apaga o vídeo ao enviar youtube_url vazio', function () {
        $id = postJson('/api/admin/palavra-viva', postFields(['youtube_url' => 'https://youtu.be/dQw4w9WgXcQ']))->assertCreated()->json('data.id');

        patchJson("/api/admin/palavra-viva/{$id}", ['youtube_url' => null])
            ->assertOk()->assertJsonPath('data.youtube_url', null)->assertJsonPath('data.youtube_video_id', null);
    });

    it('BR-042 uma mensagem agendada aparece no painel como AGENDADA e some do público', function () {
        $id = postJson('/api/admin/palavra-viva', postFields(['published_at' => now()->addDays(3)->utc()->format('Y-m-d\TH:i:s\Z')]))
            ->assertCreated()->assertJsonPath('data.status', 'AGENDADO')->json('data.id');

        getJson('/api/admin/palavra-viva')->assertOk()->assertJsonPath('data.0.id', $id);
        getJson('/api/public/palavra-viva')->assertOk()->assertJsonCount(0, 'data');
        getJson('/api/public/palavra-viva/a-graca-que-sustenta')->assertNotFound();
    });

    it('altera a mensagem, sanitiza o corpo de novo e refaz o resumo', function () {
        $id = postJson('/api/admin/palavra-viva', postFields())->assertCreated()->json('data.id');

        patchJson("/api/admin/palavra-viva/{$id}", ['body' => '<p>Outro texto</p><iframe src="https://x.test"></iframe>'])
            ->assertOk()
            ->assertJsonPath('data.body', '<p>Outro texto</p>')
            ->assertJsonPath('data.excerpt', 'Outro texto')
            ->assertJsonPath('sanitization_warning', true);
    });

    it('mostra uma mensagem para editar e responde 404 se ela não existe ou foi excluída', function () {
        $post = PalavraVivaPost::factory()->create();
        $trashed = PalavraVivaPost::factory()->trashed()->create();

        getJson("/api/admin/palavra-viva/{$post->getKey()}")->assertOk()->assertJsonPath('data.slug', $post->slug);
        getJson("/api/admin/palavra-viva/{$trashed->getKey()}")->assertNotFound();
        getJson('/api/admin/palavra-viva/999999')->assertNotFound();
        patchJson('/api/admin/palavra-viva/999999', ['title' => 'Qualquer um'])->assertNotFound();
        deleteJson('/api/admin/palavra-viva/999999')->assertNotFound();
    });

    it('exclui logicamente: 204, some do público e do painel, e o registro fica', function () {
        $id = postJson('/api/admin/palavra-viva', postFields())->assertCreated()->json('data.id');

        deleteJson("/api/admin/palavra-viva/{$id}")->assertNoContent();

        getJson('/api/public/palavra-viva/a-graca-que-sustenta')->assertNotFound();
        getJson('/api/admin/palavra-viva')->assertOk()->assertJsonCount(0, 'data');
        expect(PalavraVivaPost::withTrashed()->find($id)?->deleted_at)->not->toBeNull();
    });

    it('toda alteração pede a regeneração dos snapshots da home', function () {
        Event::fake([PublicContentChanged::class]);

        $id = postJson('/api/admin/palavra-viva', postFields())->assertCreated()->json('data.id');
        patchJson("/api/admin/palavra-viva/{$id}", ['title' => 'Outro título'])->assertOk();
        deleteJson("/api/admin/palavra-viva/{$id}")->assertNoContent();

        Event::assertDispatchedTimes(PublicContentChanged::class, 3);
        Event::assertDispatched(PublicContentChanged::class, fn (PublicContentChanged $event) => $event->snapshots === ['home']);
    });

    it('audita criar, alterar e excluir, sem o texto da mensagem', function () {
        $id = postJson('/api/admin/palavra-viva', postFields())->assertCreated()->json('data.id');
        patchJson("/api/admin/palavra-viva/{$id}", ['title' => 'Outro título', 'body' => '<p>Segredo do corpo</p>'])->assertOk();
        deleteJson("/api/admin/palavra-viva/{$id}")->assertNoContent();

        $logs = AuditLog::query()->where('resource_type', 'palavra_viva')->orderBy('id')->get();

        expect($logs->pluck('action')->all())->toBe(['palavra_viva.created', 'palavra_viva.updated', 'palavra_viva.deleted'])
            ->and(json_encode($logs->pluck('changes')))->not->toContain('Segredo do corpo');
    });

    it('lista 25 por página no painel, as mais recentes primeiro, e aceita per_page até 100', function () {
        PalavraVivaPost::factory()->count(30)->create();

        getJson('/api/admin/palavra-viva')->assertOk()->assertJsonCount(25, 'data')->assertJsonPath('meta.total', 30);
        getJson('/api/admin/palavra-viva?per_page=100')->assertOk()->assertJsonCount(30, 'data');
        getJson('/api/admin/palavra-viva?per_page=101')->assertStatus(422);
    });

    it('BR-076 só quem tem mensagens.write mexe nas mensagens', function (string $role, int $status) {
        auth()->logout();
        asStaff($role);

        getJson('/api/admin/palavra-viva')->assertStatus($status);
        postJson('/api/admin/palavra-viva', [])->assertStatus($status === 200 ? 422 : $status);
    })->with([
        'Comunicação' => ['COMUNICACAO', 200],
        'Administrador técnico (só lê usuários)' => ['ADMIN_TECNICO', 403],
        'Secretaria' => ['SECRETARIA', 403],
        'Tesouraria' => ['TESOURARIA', 403],
        'Oração' => ['ORACAO', 403],
        'Pastoral (também publica mensagens)' => ['PASTORAL', 200],
        'Líder de ministério' => ['LIDER_MINISTERIO', 403],
    ]);

    it('responde 401 sem sessão', function () {
        auth()->logout();
        test()->flushSession();

        getJson('/api/admin/palavra-viva')->assertUnauthorized();
    });
});

describe('público', function () {
    it('lista 10 por página, da mais recente à mais antiga, com excerpt e sem o corpo', function () {
        foreach (range(1, 14) as $i) {
            PalavraVivaPost::factory()->create(['slug' => "mensagem-{$i}", 'published_at' => now()->subDays(30 - $i)]);
        }

        $first = getJson('/api/public/palavra-viva')->assertOk()
            ->assertHeader('Cache-Control', 'max-age=60, public')
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta', ['page' => 1, 'per_page' => 10, 'total' => 14, 'last_page' => 2]);

        expect($first->json('data.0.slug'))->toBe('mensagem-14')
            ->and(array_keys($first->json('data.0')))->toBe(['id', 'title', 'slug', 'excerpt', 'author_display', 'youtube_video_id', 'published_at']);
        getJson('/api/public/palavra-viva?page=2')->assertOk()->assertJsonCount(4, 'data');
    });

    it('BR-042 não lista a mensagem agendada nem a excluída', function () {
        PalavraVivaPost::factory()->create(['slug' => 'no-ar', 'published_at' => now()->subDay()]);
        PalavraVivaPost::factory()->scheduled()->create(['slug' => 'agendada']);
        PalavraVivaPost::factory()->trashed()->create(['slug' => 'excluida', 'published_at' => now()->subDay()]);

        expect(getJson('/api/public/palavra-viva')->assertOk()->json('data.*.slug'))->toBe(['no-ar']);
    });

    it('mostra a mensagem pelo endereço, com o corpo, e dá 404 para agendada, excluída ou inexistente', function () {
        PalavraVivaPost::factory()->create(['slug' => 'no-ar', 'body' => '<p>Corpo</p>', 'published_at' => now()->subDay()]);
        PalavraVivaPost::factory()->scheduled()->create(['slug' => 'agendada']);
        PalavraVivaPost::factory()->trashed()->create(['slug' => 'excluida', 'published_at' => now()->subDay()]);

        getJson('/api/public/palavra-viva/no-ar')->assertOk()
            ->assertJsonPath('data.body', '<p>Corpo</p>')->assertJsonPath('data.slug', 'no-ar');
        getJson('/api/public/palavra-viva/agendada')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        getJson('/api/public/palavra-viva/excluida')->assertNotFound();
        getJson('/api/public/palavra-viva/nao-existe')->assertNotFound();
    });
});
