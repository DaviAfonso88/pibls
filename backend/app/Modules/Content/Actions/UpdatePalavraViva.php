<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Illuminate\Support\Facades\DB;

/**
 * Altera uma mensagem (CAP-03). Só os campos enviados mudam; o corpo, quando vem, é sanitizado de novo e o resumo refeito.
 */
final class UpdatePalavraViva
{
    public function __construct(
        private readonly PreparePalavraVivaFields $prepare,
        private readonly EnsurePalavraVivaSlugIsFree $ensureSlugIsFree,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $changes  `title`, `slug`, `body`, `author_display`, `youtube_url`, `published_at` (UTC)
     */
    public function __invoke(PalavraVivaPost $post, array $changes, User $actor): SavedPalavraViva
    {
        if (isset($changes['slug'])) {
            ($this->ensureSlugIsFree)((string) $changes['slug'], (int) $post->getKey());
        }

        $derived = ($this->prepare)(array_intersect_key($changes, ['body' => true, 'youtube_url' => true]));
        $plain = array_diff_key($changes, ['body' => true, 'youtube_url' => true]);

        return $this->ensureSlugIsFree->guard((string) ($changes['slug'] ?? $post->slug), function () use ($post, $plain, $derived, $actor): SavedPalavraViva {
            return DB::transaction(function () use ($post, $plain, $derived, $actor): SavedPalavraViva {
                $before = ['slug' => $post->slug, 'title' => $post->title, 'published_at' => $post->published_at->utc()->toIso8601String()];

                $post->fill([...$plain, ...$derived['fields']]);
                $post->updated_by = $actor->getKey();
                $changed = array_keys($post->getDirty());
                $post->save();

                $this->audit->record(AuditAction::PalavraVivaUpdated, 'palavra_viva', $post->getKey(), [
                    'fields' => array_values(array_diff($changed, ['updated_by', 'excerpt', 'youtube_video_id'])),
                    'before' => $before,
                    'after' => ['slug' => $post->slug, 'title' => $post->title, 'published_at' => $post->published_at->utc()->toIso8601String()],
                ]);
                event(new PublicContentChanged(['home']));

                return new SavedPalavraViva($post, $derived['sanitizationWarning']);
            });
        });
    }
}
