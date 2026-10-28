<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Files\UploadKind;
use App\Modules\Platform\Files\UploadStore;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Troca o PDF do boletim (BR-041). O arquivo novo é gravado primeiro; só depois do banco confirmar o antigo é apagado,
 * para uma falha nunca deixar o boletim apontando para um arquivo que não existe.
 */
final class ReplaceBulletinPdf
{
    public function __construct(
        private readonly UploadStore $uploads,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(Bulletin $bulletin, UploadedFile $pdf, User $actor): Bulletin
    {
        $stored = $this->uploads->store($pdf, UploadKind::BulletinPdf, 'pdf');
        $previousPath = $bulletin->pdf_path;

        try {
            DB::transaction(function () use ($bulletin, $stored, $actor): void {
                $bulletin->forceFill([
                    'pdf_path' => $stored->path,
                    'pdf_size_bytes' => $stored->sizeBytes,
                    'updated_by' => $actor->getKey(),
                ])->save();

                $this->audit->record(AuditAction::BulletinPdfReplaced, 'bulletin', $bulletin->getKey(), [
                    'after' => ['pdf_size_bytes' => $stored->sizeBytes],
                ]);
                event(new PublicContentChanged(['home']));
            });
        } catch (Throwable $e) {
            $this->uploads->delete($stored->path);

            throw $e;
        }

        $this->uploads->delete($previousPath);

        return $bulletin;
    }
}
