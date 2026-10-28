<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Database\Eloquent\Collection;

/**
 * As mensagens que entram no `sitemap.xml`: só as já publicadas (BR-042), da mais recente à mais antiga, com o que o
 * mapa precisa (endereço e datas).
 */
final class ListSitemapPosts
{
    /**
     * @return Collection<int, PalavraVivaPost>
     */
    public function __invoke(): Collection
    {
        return PalavraVivaPost::query()
            ->published()
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->get(['id', 'slug', 'published_at', 'updated_at']);
    }
}
