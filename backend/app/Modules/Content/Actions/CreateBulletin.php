<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\StoredFile;
use App\Modules\Platform\Files\UploadKind;
use App\Modules\Platform\Files\UploadStore;
use Carbon\CarbonInterface;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Cadastra um boletim com o PDF ou com o link externo (CAP-02, BR-040, BR-041, BR-084). O PDF só vira arquivo público
 * depois de passar pelo `UploadStore`; se o banco recusar, o arquivo é apagado. `published_at` no futuro deixa o boletim
 * agendado (BR-042).
 */
final class CreateBulletin
{
    public function __construct(
        private readonly UploadStore $uploads,
        private readonly EnsureBulletinEditionIsFree $ensureEditionIsFree,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array{edition_number: int, reference_date: string, title: string, summary_text?: string|null, external_url?: string|null}  $data
     * @param  UploadedFile|null  $pdf  vazio quando o boletim vem com `external_url`
     */
    public function __invoke(array $data, ?UploadedFile $pdf, ?CarbonInterface $publishedAt, User $actor): Bulletin
    {
        ($this->ensureEditionIsFree)($data['edition_number']);

        $stored = $pdf === null ? null : $this->uploads->store($pdf, UploadKind::BulletinPdf, 'pdf');

        try {
            return DB::transaction(function () use ($data, $stored, $publishedAt, $actor): Bulletin {
                $bulletin = Bulletin::query()->create([
                    'edition_number' => $data['edition_number'],
                    'reference_date' => $data['reference_date'],
                    'title' => $data['title'],
                    'summary_text' => $data['summary_text'] ?? null,
                    'pdf_path' => $stored?->path,
                    'pdf_size_bytes' => $stored?->sizeBytes,
                    'external_url' => $data['external_url'] ?? null,
                    'published_at' => ($publishedAt ?? now())->utc(),
                    'created_by' => $actor->getKey(),
                    'updated_by' => $actor->getKey(),
                ]);

                $this->audit->record(AuditAction::BulletinCreated, 'bulletin', $bulletin->getKey(), [
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
            $this->discard($stored);

            throw EnsureBulletinEditionIsFree::duplicate($data['edition_number']);
        } catch (Throwable $e) {
            $this->discard($stored);

            throw $e;
        }
    }

    private function discard(?StoredFile $stored): void
    {
        if ($stored !== null) {
            $this->uploads->delete($stored->path);
        }
    }
}
