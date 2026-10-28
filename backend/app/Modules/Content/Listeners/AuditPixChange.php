<?php

declare(strict_types=1);

namespace App\Modules\Content\Listeners;

use App\Modules\Content\Events\PixSettingsChanged;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;

/**
 * Auditoria da alteração do PIX (CAP-18): quem, quando (o próprio registro tem), o valor anterior e o novo. Roda na
 * transação da alteração: sem o registro, a alteração não vale. O QR e o código Copia e Cola não entram; só o que eles
 * são (existe ou não) e quais campos mudaram.
 */
final class AuditPixChange
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function handle(PixSettingsChanged $event): void
    {
        $this->audit->record(AuditAction::PixUpdated, 'site_setting', 'pix', [
            'fields' => $event->changedFields,
            'before' => $event->before,
            'after' => $event->after,
        ], $event->actorId);
    }
}
