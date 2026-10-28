<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Cadastra uma mensagem da Palavra Viva (CAP-03, BR-032, BR-044, BR-046). O corpo é sanitizado e o resumo gerado aqui,
 * no servidor. `published_at` no futuro deixa a mensagem agendada (BR-042).
 */
final class CreatePalavraViva
{
    public function __construct(
        private readonly PreparePalavraVivaFields $prepare,
        private readonly EnsurePalavraVivaSlugIsFree $ensureSlugIsFree,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{title: string, slug: string, body: string, author_display?: string|null, youtube_url?: string|null}  $data
     */
    public function __invoke(array $data, ?CarbonInterface $publishedAt, User $actor): SavedPalavraViva
    {
        ($this->ensureSlugIsFree)($data['slug']);
        $derived = ($this->prepare)(['body' => $data['body'], 'youtube_url' => $data['youtube_url'] ?? null]);

        return $this->ensureSlugIsFree->guard($data['slug'], function () use ($data, $derived, $publishedAt, $actor): SavedPalavraViva {
            return DB::transaction(function () use ($data, $derived, $publishedAt, $actor): SavedPalavraViva {
                $post = PalavraVivaPost::query()->create([
                    'title' => $data['title'],
                    'slug' => $data['slug'],
                    'author_display' => $data['author_display'] ?? null,
                    'published_at' => ($publishedAt ?? now())->utc(),
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                    ...$derived['fields'],
                ]);

                $this->audit->record(AuditAction::PalavraVivaCreated, 'palavra_viva', $post->getKey(), [
                    'after' => ['slug' => $post->slug, 'title' => $post->title, 'published_at' => $post->published_at->utc()->toIso8601String()],
                ]);
                event(new PublicContentChanged(['home']));

                return new SavedPalavraViva($post, $derived['sanitizationWarning']);
            });
        });
    }
}
