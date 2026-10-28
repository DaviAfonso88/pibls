<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Export\RegistrationsExport;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;

/**
 * Prepara a planilha das inscrições e registra a exportação na auditoria (`registrations.exported`), só com o evento e a
 * quantidade de linhas: nunca nome, telefone nem resposta. A auditoria é gravada antes de a primeira linha sair, então uma
 * conexão interrompida no meio do download não apaga o rastro de quem baixou.
 */
final class ExportRegistrations
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(Event $event): RegistrationsExport
    {
        $this->audit->record(
            AuditAction::RegistrationsExported,
            'event',
            $event->getKey(),
            ['count' => $event->registrations()->count()],
        );

        return new RegistrationsExport($event);
    }
}
