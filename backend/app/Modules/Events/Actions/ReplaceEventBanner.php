<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\UploadKind;
use App\Modules\Platform\Files\UploadStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Troca o banner do evento (BR-045): o `UploadStore` confere o tipo pelo conteúdo e grava o WebP de 1600 px e o de 800 px,
 * sem EXIF. Os arquivos novos são gravados primeiro; só depois de o banco confirmar os antigos são apagados, para uma
 * falha nunca deixar o evento apontando para um arquivo que não existe.
 */
final class ReplaceEventBanner
{
    public function __construct(
        private readonly UploadStore $uploads,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(Event $event, UploadedFile $banner, User $actor): Event
    {
        $stored = $this->uploads->store($banner, UploadKind::EventBanner, 'banner');
        $previousPath = $event->banner_path;

        try {
            DB::transaction(function () use ($event, $stored, $actor): void {
                $event->forceFill(['banner_path' => $stored->path, 'updated_by' => $actor->getKey()])->save();

                $this->audit->record(AuditAction::EventUpdated, 'event', $event->getKey(), ['fields' => ['banner_path']]);

                if ($event->is_published) {
                    event(new PublicContentChanged(['home']));
                }
            });
        } catch (Throwable $e) {
            $this->uploads->delete($stored->path);

            throw $e;
        }

        if ($previousPath !== null) {
            $this->uploads->delete($previousPath);
        }

        return $event;
    }
}
