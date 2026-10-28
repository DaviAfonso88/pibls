<?php

declare(strict_types=1);

namespace App\Modules\Platform\Web;

/**
 * Quem acrescenta páginas ao `sitemap.xml` além das fixas e das mensagens: o módulo de eventos, com a flag ligada. O
 * `SitemapController` (Content) junta o que as fontes de `SitemapSources` devolvem.
 */
interface SitemapSource
{
    /**
     * @return list<array{path: string, lastmod: string|null}> `path` começa com `/`; `lastmod` em `AAAA-MM-DD`
     */
    public function entries(): array;
}
