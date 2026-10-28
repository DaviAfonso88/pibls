<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\UploadStore;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Support\Facades\DB;

/**
 * Exclusão definitiva do evento, só sem inscrições (BR-028): com inscrições, o caminho é despublicar. O banner sai do
 * disco depois de o banco confirmar, para uma falha nunca deixar o evento apontando para um arquivo que não existe.
 */
final class DeleteEvent
{
    public function __construct(
        private readonly UploadStore $uploads,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(Event $event, User $actor): void
    {
        if ($event->registrations()->exists()) {
            throw new BusinessRuleException('EVENT_HAS_REGISTRATIONS', __('business.BR-028'));
        }

        $wasPublished = $event->is_published;
        $bannerPath = $event->banner_path;

        DB::transaction(function () use ($event, $wasPublished): void {
            $event->delete();

            $this->audit->record(AuditAction::EventDeleted, 'event', $event->getKey(), [
                'before' => ['slug' => $event->slug, 'title' => $event->title, 'ministry_id' => $event->ministry_id],
            ]);

            if ($wasPublished) {
                event(new PublicContentChanged(['home']));
            }
        });

        if ($bannerPath !== null) {
            $this->uploads->delete($bannerPath);
        }
    }
}
