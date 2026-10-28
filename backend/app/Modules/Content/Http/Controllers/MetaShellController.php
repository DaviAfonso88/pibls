<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Content\Actions\FindPublishedPalavraViva;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Content\Support\YouTubeUrl;
use App\Modules\Platform\Web\MetaShell;
use Illuminate\Http\Response;

/**
 * `GET /palavra-viva/{slug}` (ADR-004): o HTML de fallback da SPA com a meta da mensagem injetada, para o WhatsApp e os
 * buscadores lerem título, resumo e imagem sem executar JavaScript. Mensagem inexistente, agendada ou excluída devolve
 * o mesmo HTML com status 404 e `noindex` (BR-042); a SPA mostra a página de "não encontrado".
 */
final class MetaShellController
{
    private const SITE_NAME = 'Primeira Igreja Batista em Lagoa Santa';

    private const SHORT_NAME = 'PIBLS';

    public function __invoke(string $slug, FindPublishedPalavraViva $find): Response
    {
        $post = $find->exists($slug);

        if ($post === null) {
            return $this->html(
                MetaShell::inject(MetaShell::load(), [
                    'title' => 'Página não encontrada — '.self::SHORT_NAME,
                    'description' => 'Não encontramos o que você procurou.',
                    'url' => $this->absolute('/palavra-viva/'.$slug),
                    'image' => $this->absolute('/og-default.png'),
                    'siteName' => self::SITE_NAME,
                ], null, noindex: true),
                404,
                'no-store',
            );
        }

        return $this->html(
            MetaShell::inject(MetaShell::load(), $this->meta($post), $this->article($post)),
            200,
            'public, max-age=300',
        );
    }

    /**
     * @return array{title: string, description: string, url: string, image: string, siteName: string}
     */
    private function meta(PalavraVivaPost $post): array
    {
        return [
            'title' => $post->title.' — '.self::SHORT_NAME,
            'description' => $post->excerpt,
            'url' => $this->absolute('/palavra-viva/'.$post->slug),
            'image' => $this->image($post),
            'siteName' => self::SITE_NAME,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function article(PalavraVivaPost $post): array
    {
        $article = [
            '@context' => 'https://schema.org',
            '@type' => 'Article',
            'headline' => $post->title,
            'description' => $post->excerpt,
            'datePublished' => $post->published_at->utc()->toIso8601String(),
            'dateModified' => ($post->updated_at ?? $post->published_at)->utc()->toIso8601String(),
            'mainEntityOfPage' => $this->absolute('/palavra-viva/'.$post->slug),
            'image' => $this->image($post),
            'publisher' => ['@type' => 'Organization', 'name' => self::SITE_NAME],
        ];

        if ($post->author_display !== null && $post->author_display !== '') {
            $article['author'] = ['@type' => 'Person', 'name' => $post->author_display];
        }

        return $article;
    }

    /** A miniatura do vídeo, se a mensagem tem um; senão, a imagem padrão da igreja. */
    private function image(PalavraVivaPost $post): string
    {
        $video = YouTubeUrl::tryParse($post->youtube_url);

        return $video?->thumbnail() ?? $this->absolute('/og-default.png');
    }

    private function absolute(string $path): string
    {
        return rtrim((string) config('app.url'), '/').$path;
    }

    private function html(string $html, int $status, string $cacheControl): Response
    {
        return response($html, $status, [
            'Content-Type' => 'text/html; charset=UTF-8',
            'Cache-Control' => $cacheControl,
        ]);
    }
}
