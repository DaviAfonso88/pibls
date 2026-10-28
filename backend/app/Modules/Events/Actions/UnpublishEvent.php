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
 * Despublica o evento: volta a rascunho, some do site e passa a dar 404. As inscrições já feitas continuam guardadas.
 */
final class UnpublishEvent
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  bool  $refreshSnapshots  `false` quando quem chama já regenera a página inicial uma vez só
     * @return bool `false` se o evento já era rascunho (nada mudou)
     */
    public function __invoke(Event $event, User $actor, bool $refreshSnapshots = true): bool
    {
        if (! $event->is_published) {
            return false;
        }

        DB::transaction(function () use ($event, $actor, $refreshSnapshots): void {
            $event->forceFill(['is_published' => false, 'updated_by' => $actor->getKey()])->save();

            $this->audit->record(AuditAction::EventUnpublished, 'event', $event->getKey(), [
                'after' => ['slug' => $event->slug, 'title' => $event->title],
            ]);

            if ($refreshSnapshots) {
                event(new PublicContentChanged(['home']));
            }
        });

        return true;
    }
}
