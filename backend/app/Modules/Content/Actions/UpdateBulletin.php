<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\UploadStore;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Altera os metadados e o link externo do boletim (o PDF tem a sua própria Action). Só os campos enviados mudam. Passar a
 * usar o link aposenta o PDF (BR-084): o arquivo só é apagado depois do banco confirmar.
 */
final class UpdateBulletin
{
    public function __construct(
        private readonly EnsureBulletinEditionIsFree $ensureEditionIsFree,
        private readonly UploadStore $uploads,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $changes  `edition_number`, `reference_date`, `title`, `summary_text`, `published_at` (UTC), `external_url`
     */
    public function __invoke(Bulletin $bulletin, array $changes, User $actor): Bulletin
    {
        if (isset($changes['edition_number'])) {
            ($this->ensureEditionIsFree)((int) $changes['edition_number'], (int) $bulletin->getKey());
        }

        $previousPdf = null;
        if (isset($changes['external_url'])) {
            $previousPdf = $bulletin->pdf_path;
            $changes += ['pdf_path' => null, 'pdf_size_bytes' => null];
        }

        try {
            $saved = DB::transaction(function () use ($bulletin, $changes, $actor): Bulletin {
                $before = [
                    'edition_number' => $bulletin->edition_number,
                    'title' => $bulletin->title,
                    'external_url' => $bulletin->external_url,
                    'published_at' => $bulletin->published_at->utc()->toIso8601String(),
                ];

                $bulletin->fill($changes);
                $bulletin->updated_by = $actor->getKey();
                $changed = array_keys($bulletin->getDirty());
                $bulletin->save();

                $this->audit->record(AuditAction::BulletinUpdated, 'bulletin', $bulletin->getKey(), [
                    'fields' => array_values(array_diff($changed, ['updated_by'])),
                    'before' => $before,
                    'after' => [
                        'edition_number' => $bulletin->edition_number,
                        'title' => $bulletin->title,
                        'external_url' => $bulletin->external_url,
                        'published_at' => $bulletin->published_at->utc()->toIso8601String(),
                    ],
                ]);
                event(new PublicContentChanged(['home']));

                return $bulletin;
            });
        } catch (UniqueConstraintViolationException) {
            throw EnsureBulletinEditionIsFree::duplicate((int) ($changes['edition_number'] ?? $bulletin->edition_number));
        }

        if ($previousPdf !== null) {
            $this->uploads->delete($previousPdf);
        }

        return $saved;
    }
}
