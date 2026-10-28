<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Content\Actions\ListSitemapPosts;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Platform\Web\SitemapSources;
use Illuminate\Http\Response;

/**
 * `GET /sitemap.xml`: as páginas fixas e as mensagens publicadas, com `lastmod` (FR-008). Mensagem agendada ou excluída
 * não entra (BR-042). Os eventos publicados entram por `SitemapSources`, registrado pelo módulo Events com a flag `events` ligada (T177).
 */
final class SitemapController
{
    /** As páginas públicas pré-renderizadas (contracts/web-routes.md), sem as que dependem de flag. */
    private const FIXED_PATHS = [
        '/', '/quem-somos', '/ministerios', '/grupos', '/boletins', '/palavra-viva', '/contribua',
        '/como-chegar', '/sou-visitante', '/quero-ser-membro', '/pedido-de-oracao', '/contato', '/privacidade',
    ];

    public function __invoke(ListSitemapPosts $posts, SitemapSources $sources): Response
    {
        $base = rtrim((string) config('app.url'), '/');
        $urls = array_map(fn (string $path): string => $this->entry($base.$path), self::FIXED_PATHS);

        $posts()->each(function (PalavraVivaPost $post) use (&$urls, $base): void {
            $urls[] = $this->entry($base.'/palavra-viva/'.$post->slug, ($post->updated_at ?? $post->published_at)->utc()->format('Y-m-d'));
        });

        // Páginas de outros módulos (a lista e os eventos publicados, com a flag `events` ligada)
        foreach ($sources->entries() as $entry) {
            $urls[] = $this->entry($base.$entry['path'], $entry['lastmod']);
        }

        $xml = '<?xml version="1.0" encoding="UTF-8"?>'."\n"
            .'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'."\n"
            .implode("\n", $urls)."\n</urlset>\n";

        return response($xml, 200, [
            'Content-Type' => 'application/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    private function entry(string $location, ?string $lastModified = null): string
    {
        $loc = htmlspecialchars($location, ENT_XML1 | ENT_QUOTES, 'UTF-8');

        return '  <url><loc>'.$loc.'</loc>'.($lastModified === null ? '' : '<lastmod>'.$lastModified.'</lastmod>').'</url>';
    }
}
