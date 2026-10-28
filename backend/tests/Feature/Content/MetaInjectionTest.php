<?php

declare(strict_types=1);

use App\Modules\Content\Models\PalavraVivaPost;

use function Pest\Laravel\get;

/*
| GET /palavra-viva/{slug} e GET /sitemap.xml (T110; contracts/web-routes.md). O Laravel devolve o HTML de fallback da SPA
| com a meta injetada. O teste obrigatório: o título de uma mensagem não pode quebrar a página nem injetar script.
*/

const FALLBACK_HTML = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
    .'<title>Título genérico</title><meta name="description" content="Descrição genérica">'
    .'<meta property="og:title" content="Genérico"><meta name="twitter:card" content="summary">'
    .'<link rel="canonical" href="https://pibls.test/generico">'
    .'<script type="application/ld+json">{"@type":"Genérico"}</script>'
    .'<link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"></div></body></html>';

beforeEach(function () {
    $this->fallback = tempnam(sys_get_temp_dir(), 'spa');
    file_put_contents($this->fallback, FALLBACK_HTML);
    config(['pibls.spa_fallback_path' => $this->fallback, 'app.url' => 'https://pibls.test']);
});

afterEach(function () {
    @unlink($this->fallback);
});

/** O JSON-LD da página, já decodificado. @return array<string, mixed> */
function jsonLdOf(string $html): array
{
    preg_match('#<script type="application/ld\+json">(.*?)</script>#s', $html, $match);

    return json_decode($match[1] ?? '{}', true, flags: JSON_THROW_ON_ERROR);
}

describe('GET /palavra-viva/{slug}', function () {
    it('devolve o HTML da SPA com título, descrição, Open Graph e JSON-LD da mensagem', function () {
        PalavraVivaPost::factory()->create([
            'title' => 'A graça que sustenta',
            'slug' => 'a-graca-que-sustenta',
            'excerpt' => 'Um resumo curto da mensagem.',
            'author_display' => 'Pr. Fulano',
            'published_at' => '2025-11-08 12:00:00',
        ]);

        $response = get('/palavra-viva/a-graca-que-sustenta')
            ->assertOk()
            ->assertHeader('Cache-Control', 'max-age=300, public');
        $html = $response->getContent();

        expect($response->headers->get('Content-Type'))->toStartWith('text/html')
            ->and($html)->toContain('<title>A graça que sustenta — PIBLS</title>')
            ->toContain('<meta name="description" content="Um resumo curto da mensagem.">')
            ->toContain('<meta property="og:type" content="website">')
            ->toContain('<meta property="og:title" content="A graça que sustenta — PIBLS">')
            ->toContain('<meta property="og:description" content="Um resumo curto da mensagem.">')
            ->toContain('<meta property="og:url" content="https://pibls.test/palavra-viva/a-graca-que-sustenta">')
            ->toContain('<meta property="og:image" content="https://pibls.test/og-default.png">')
            ->toContain('<link rel="canonical" href="https://pibls.test/palavra-viva/a-graca-que-sustenta">')
            ->toContain('<div id="root"></div>')
            ->toContain('<link rel="stylesheet" href="/assets/app.css">');

        $article = jsonLdOf($html);
        expect($article)->toMatchArray([
            '@context' => 'https://schema.org',
            '@type' => 'Article',
            'headline' => 'A graça que sustenta',
            'description' => 'Um resumo curto da mensagem.',
            'datePublished' => '2025-11-08T12:00:00+00:00',
        ])->and($article['author'])->toBe(['@type' => 'Person', 'name' => 'Pr. Fulano'])
            ->and($article['image'])->toBe('https://pibls.test/og-default.png');
    });

    it('troca a meta genérica da SPA pela da mensagem, sem deixar duplicata', function () {
        PalavraVivaPost::factory()->create(['slug' => 'mensagem', 'published_at' => now()->subDay()]);

        $html = (string) get('/palavra-viva/mensagem')->assertOk()->getContent();

        expect($html)->not->toContain('Título genérico')->not->toContain('Descrição genérica')->not->toContain('Genérico')
            ->not->toContain('https://pibls.test/generico')
            ->and(substr_count($html, '<title>'))->toBe(1)
            ->and(substr_count($html, 'property="og:title"'))->toBe(1)
            ->and(substr_count($html, 'application/ld+json'))->toBe(1);
    });

    it('usa a miniatura do YouTube como og:image quando a mensagem tem vídeo', function () {
        PalavraVivaPost::factory()->create([
            'slug' => 'com-video',
            'youtube_url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            'youtube_video_id' => 'dQw4w9WgXcQ',
            'published_at' => now()->subDay(),
        ]);

        $html = (string) get('/palavra-viva/com-video')->assertOk()->getContent();

        expect($html)->toContain('<meta property="og:image" content="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg">')
            ->and(jsonLdOf($html)['image'])->toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
    });

    it('escapa o HTML do banco: o título e o resumo não quebram a página nem injetam script', function () {
        $title = '</title><script>alert(1)</script><img src=x onerror=alert(2)> "aspas" & \'apóstrofo\'';
        PalavraVivaPost::factory()->create([
            'slug' => 'ataque',
            'title' => $title,
            'excerpt' => '"><script>alert(3)</script>',
            'author_display' => '</script><script>alert(4)</script>',
            'published_at' => now()->subDay(),
        ]);

        $html = (string) get('/palavra-viva/ataque')->assertOk()->getContent();

        expect($html)->not->toContain('<script>alert')
            ->not->toContain('<img src=x')
            ->not->toContain('</title><script>')
            ->toContain('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
            ->and(substr_count($html, '<script'))->toBe(1) // só o bloco do JSON-LD
            ->and(substr_count($html, '</script>'))->toBe(1)
            ->and(substr_count($html, '<title>'))->toBe(1);

        $article = jsonLdOf($html);
        expect($article['headline'])->toBe($title)
            ->and($article['author']['name'])->toBe('</script><script>alert(4)</script>');
    });

    it('BR-042 dá 404 para a mensagem agendada, excluída ou inexistente, sem vazar o título', function (string $slug) {
        PalavraVivaPost::factory()->scheduled()->create(['slug' => 'agendada', 'title' => 'Título secreto da agendada']);
        PalavraVivaPost::factory()->trashed()->create(['slug' => 'excluida', 'title' => 'Título da excluída', 'published_at' => now()->subDay()]);

        $response = get("/palavra-viva/{$slug}")->assertNotFound()->assertHeader('Cache-Control', 'no-store, private');
        $html = (string) $response->getContent();

        expect($html)->toContain('<meta name="robots" content="noindex">')
            ->toContain('<div id="root"></div>')
            ->not->toContain('secreto')->not->toContain('Título da excluída')
            ->and($response->headers->get('Content-Type'))->toStartWith('text/html');
    })->with(['agendada', 'excluida', 'nao-existe']);

    it('não abre sessão nem manda cookie, porque a resposta é pública e cacheável', function () {
        PalavraVivaPost::factory()->create(['slug' => 'mensagem', 'published_at' => now()->subDay()]);

        $response = get('/palavra-viva/mensagem')->assertOk();

        expect($response->headers->getCookies())->toBe([]);
    });

    it('funciona sem o arquivo de fallback, com um HTML mínimo', function () {
        config(['pibls.spa_fallback_path' => '/nao/existe/__spa-fallback.html']);
        PalavraVivaPost::factory()->create(['slug' => 'mensagem', 'title' => 'Sem build', 'published_at' => now()->subDay()]);

        get('/palavra-viva/mensagem')->assertOk()->assertSee('<title>Sem build — PIBLS</title>', false)->assertSee('<div id="root"></div>', false);
    });

    it('rejeita um endereço fora do padrão sem consultar a mensagem', function (string $path) {
        get("/palavra-viva/{$path}")->assertNotFound();
    })->with(['Maiusculas', 'com_underline', 'a.b']);
});

describe('GET /sitemap.xml', function () {
    it('lista as páginas fixas e as mensagens publicadas, com lastmod, e cache de 1 h', function () {
        PalavraVivaPost::factory()->create(['slug' => 'no-ar', 'published_at' => '2025-10-01 10:00:00', 'updated_at' => '2025-11-02 08:00:00']);
        PalavraVivaPost::factory()->scheduled()->create(['slug' => 'agendada']);
        PalavraVivaPost::factory()->trashed()->create(['slug' => 'excluida', 'published_at' => now()->subDay()]);

        $response = get('/sitemap.xml')->assertOk()->assertHeader('Cache-Control', 'max-age=3600, public');
        $xml = (string) $response->getContent();

        $document = simplexml_load_string($xml);
        expect($document)->not->toBeFalse()
            ->and($response->headers->get('Content-Type'))->toStartWith('application/xml');

        $locs = array_map('strval', iterator_to_array($document->url->loc ?? [], false));
        $all = [];
        foreach ($document->url as $url) {
            $all[(string) $url->loc] = isset($url->lastmod) ? (string) $url->lastmod : null;
        }

        expect(array_keys($all))->toContain(
            'https://pibls.test/', 'https://pibls.test/quem-somos', 'https://pibls.test/boletins', 'https://pibls.test/palavra-viva',
            'https://pibls.test/contato', 'https://pibls.test/privacidade', 'https://pibls.test/palavra-viva/no-ar',
        )->not->toContain('https://pibls.test/palavra-viva/agendada', 'https://pibls.test/palavra-viva/excluida', 'https://pibls.test/eventos')
            ->and($all['https://pibls.test/palavra-viva/no-ar'])->toBe('2025-11-02')
            ->and($locs)->not->toBeNull();
    });

    it('escapa o endereço no XML e não abre sessão', function () {
        PalavraVivaPost::factory()->create(['slug' => 'a-b', 'published_at' => now()->subDay()]);

        $response = get('/sitemap.xml')->assertOk();

        expect(simplexml_load_string((string) $response->getContent()))->not->toBeFalse()
            ->and($response->headers->getCookies())->toBe([]);
    });
});
