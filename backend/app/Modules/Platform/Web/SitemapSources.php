<?php

declare(strict_types=1);

namespace App\Modules\Platform\Web;

/**
 * As fontes de páginas do sitemap registradas pelos módulos. Singleton, preenchido na inicialização.
 */
final class SitemapSources
{
    /** @var list<SitemapSource> */
    private array $sources = [];

    public function register(SitemapSource $source): void
    {
        $this->sources[] = $source;
    }

    /**
     * @return list<array{path: string, lastmod: string|null}>
     */
    public function entries(): array
    {
        $entries = [];

        foreach ($this->sources as $source) {
            array_push($entries, ...$source->entries());
        }

        return $entries;
    }
}
