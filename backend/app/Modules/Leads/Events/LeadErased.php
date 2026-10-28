<?php

declare(strict_types=1);

namespace App\Modules\Leads\Events;

use App\Modules\Leads\Enums\LeadType;

/**
 * Um contato foi excluído em definitivo (BR-081). `reason` é o motivo do pedido (`TITULAR_REQUEST`). A auditoria registra
 * só o tipo e o motivo: nenhum dado pessoal sobrevive à exclusão.
 */
final readonly class LeadErased
{
    public function __construct(
        public int $leadId,
        public LeadType $type,
        public string $reason,
        public int $actorId,
    ) {}
}
