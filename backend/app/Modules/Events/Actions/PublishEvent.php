<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Illuminate\Support\Facades\DB;

/**
 * Publica o evento (CAP-12). Com o prazo de inscrição já vencido, o evento sai com as inscrições encerradas: o aviso da
 * BR-033 é uma confirmação da tela, o servidor publica do mesmo jeito.
 */
final class PublishEvent
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  bool  $refreshSnapshots  `false` quando quem chama (criar, alterar) já regenera a página inicial uma vez só
     * @return bool `false` se o evento já estava publicado (nada mudou)
     */
    public function __invoke(Event $event, User $actor, bool $refreshSnapshots = true): bool
    {
        if ($event->is_published) {
            return false;
        }

        DB::transaction(function () use ($event, $actor, $refreshSnapshots): void {
            $event->forceFill(['is_published' => true, 'updated_by' => $actor->getKey()])->save();

            $this->audit->record(AuditAction::EventPublished, 'event', $event->getKey(), [
                'after' => ['slug' => $event->slug, 'title' => $event->title],
            ]);

            if ($refreshSnapshots) {
                event(new PublicContentChanged(['home']));
            }
        });

        return true;
    }
}
