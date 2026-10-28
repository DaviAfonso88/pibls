<?php

declare(strict_types=1);

namespace App\Modules\Platform\Web;

/**
 * O HTML de fallback da SPA (`__spa-fallback.html`) com a meta da página injetada (ADR-004): `<title>`, `description`,
 * Open Graph e JSON-LD. Serve às páginas de detalhe, cujo conteúdo vem do banco e não existe no build.
 *
 * Tudo que vem do banco é escapado: o título de uma mensagem não pode fechar a tag nem injetar script. O JSON-LD usa as
 * opções `JSON_HEX_*`, que trocam `<`, `>`, `&`, `'` e `"` por escapes, então um `</script>` no texto não escapa do bloco.
 */
final class MetaShell
{
    private const MINIMAL_SHELL = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        .'<meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>';

    /** Pega o fallback de `pibls.spa_fallback_path`; sem o arquivo (local sem build, CI), um HTML mínimo. */
    public static function load(): string
    {
        $path = (string) config('pibls.spa_fallback_path');
        $html = is_file($path) ? file_get_contents($path) : false;

        return is_string($html) && $html !== '' ? $html : self::MINIMAL_SHELL;
    }

    /**
     * @param  array{title: string, description: string, url: string, image: string, siteName: string}  $meta
     * @param  array<string, mixed>|null  $jsonLd
     */
    public static function inject(string $html, array $meta, ?array $jsonLd = null, bool $noindex = false): string
    {
        $head = [
            '<title>'.e($meta['title']).'</title>',
            '<meta name="description" content="'.e($meta['description']).'">',
            '<link rel="canonical" href="'.e($meta['url']).'">',
            '<meta property="og:type" content="website">',
            '<meta property="og:site_name" content="'.e($meta['siteName']).'">',
            '<meta property="og:locale" content="pt_BR">',
            '<meta property="og:title" content="'.e($meta['title']).'">',
            '<meta property="og:description" content="'.e($meta['description']).'">',
            '<meta property="og:url" content="'.e($meta['url']).'">',
            '<meta property="og:image" content="'.e($meta['image']).'">',
            '<meta name="twitter:card" content="summary_large_image">',
        ];

        if ($noindex) {
            $head[] = '<meta name="robots" content="noindex">';
        }

        if ($jsonLd !== null) {
            $head[] = '<script type="application/ld+json">'.self::json($jsonLd).'</script>';
        }

        return self::replaceHead($html, implode('', $head));
    }

    /** @param  array<string, mixed>  $data */
    public static function json(array $data): string
    {
        return (string) json_encode(
            $data,
            JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
        );
    }

    /** Tira da `<head>` o que a página genérica já tinha (título, descrição, OG, canonical, JSON-LD) e põe o novo no fim. */
    private static function replaceHead(string $html, string $injected): string
    {
        if (preg_match('#<head\b[^>]*>(.*?)</head>#is', $html, $match, PREG_OFFSET_CAPTURE) !== 1) {
            return $html;
        }

        $inner = $match[1][0];
        $inner = (string) preg_replace('#<title\b[^>]*>.*?</title>#is', '', $inner);
        $inner = (string) preg_replace('#<meta\b[^>]*\b(?:name|property)\s*=\s*["\'](?:description|og:[^"\']*|twitter:[^"\']*|robots)["\'][^>]*>#i', '', $inner);
        $inner = (string) preg_replace('#<link\b[^>]*\brel\s*=\s*["\']canonical["\'][^>]*>#i', '', $inner);
        $inner = (string) preg_replace('#<script\b[^>]*type\s*=\s*["\']application/ld\+json["\'][^>]*>.*?</script>#is', '', $inner);

        return substr_replace($html, $inner.$injected, $match[1][1], strlen($match[1][0]));
    }
}
