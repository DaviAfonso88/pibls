<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\UploadStore;
use Illuminate\Support\Facades\DB;

/**
 * Remove o banner do evento e apaga os dois arquivos do disco. Remover quando não há banner não faz nada.
 */
final class RemoveEventBanner
{
    public function __construct(
        private readonly UploadStore $uploads,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(Event $event, User $actor): void
    {
        $path = $event->banner_path;

        if ($path === null) {
            return;
        }

        DB::transaction(function () use ($event, $actor): void {
            $event->forceFill(['banner_path' => null, 'updated_by' => $actor->getKey()])->save();

            $this->audit->record(AuditAction::EventUpdated, 'event', $event->getKey(), ['fields' => ['banner_path']]);

            if ($event->is_published) {
                event(new PublicContentChanged(['home']));
            }
        });

        $this->uploads->delete($path);
    }
}
