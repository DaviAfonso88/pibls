<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Illuminate\Support\Facades\DB;

/**
 * Exclusão lógica do boletim (ADR-009): sai do site e da lista, mas o registro e o PDF ficam no disco para o
 * administrador técnico recuperar. A edição volta a ficar livre (BR-040).
 */
final class DeleteBulletin
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(Bulletin $bulletin, User $actor): void
    {
        DB::transaction(function () use ($bulletin, $actor): void {
            $bulletin->forceFill(['updated_by' => $actor->getKey()])->save();
            $bulletin->delete();

            $this->audit->record(AuditAction::BulletinDeleted, 'bulletin', $bulletin->getKey(), [
                'before' => ['edition_number' => $bulletin->edition_number, 'title' => $bulletin->title],
            ]);
            event(new PublicContentChanged(['home']));
        });
    }
}
