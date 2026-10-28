<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Http\Resources\BulletinPublicResource;
use App\Modules\Content\Http\Resources\PalavraVivaSummaryResource;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;

/**
 * Destaques da página inicial (`data/home.json`): o último boletim publicado e as 3 últimas mensagens. Conteúdo
 * agendado (`published_at` no futuro) e excluído não entra (BR-042). `upcoming_events` é sempre vazio na R1: a lista
 * de eventos entra na R2, com a flag ligada (T177).
 */
final class LoadHomeHighlights
{
    private const LATEST_POSTS = 3;

    /**
     * @return array{latest_bulletin: array<string, mixed>|null, latest_posts: list<array<string, mixed>>, upcoming_events: list<array<string, mixed>>}
     */
    public function __invoke(): array
    {
        $bulletin = Bulletin::query()
            ->where('published_at', '<=', now())
            ->orderByDesc('reference_date')
            ->orderByDesc('edition_number')
            ->first();

        $posts = PalavraVivaPost::query()
            ->where('published_at', '<=', now())
            ->orderByDesc('published_at')
            ->orderByDesc('id')
            ->limit(self::LATEST_POSTS)
            ->get();

        return [
            'latest_bulletin' => $bulletin === null ? null : (new BulletinPublicResource($bulletin))->resolve(),
            'latest_posts' => array_values(PalavraVivaSummaryResource::collection($posts)->resolve()),
            'upcoming_events' => [],
        ];
    }
}
