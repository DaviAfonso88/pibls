<?php

declare(strict_types=1);

namespace App\Modules\Leads\Events;

use App\Modules\Leads\Enums\LeadType;
use Carbon\CarbonImmutable;

/**
 * Um contato foi gravado (domínio: Leads). Emitido dentro da transação do `SubmitLead`; o listener grava na fila de
 * e-mails um aviso por destinatário, na mesma transação (ADR-003). Leva só identificadores: nada de dado pessoal.
 */
final readonly class LeadReceived
{
    public function __construct(
        public int $leadId,
        public LeadType $type,
        public ?int $ministryId,
        public CarbonImmutable $receivedAt,
    ) {}
}
