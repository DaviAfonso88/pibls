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
 * Exclusão lógica da mensagem (ADR-009). O endereço volta a ficar livre (BR-032) e a página pública passa a dar 404.
 */
final class DeletePalavraViva
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(PalavraVivaPost $post, User $actor): void
    {
        DB::transaction(function () use ($post, $actor): void {
            $post->forceFill(['updated_by' => $actor->getKey()])->save();
            $post->delete();

            $this->audit->record(AuditAction::PalavraVivaDeleted, 'palavra_viva', $post->getKey(), [
                'before' => ['slug' => $post->slug, 'title' => $post->title],
            ]);
            event(new PublicContentChanged(['home']));
        });
    }
}
