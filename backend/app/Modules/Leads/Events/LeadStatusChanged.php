<?php

declare(strict_types=1);

namespace App\Modules\Leads\Events;

use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Enums\LeadType;

/** O status de um contato mudou (domínio: Leads). Só identificadores e estados: nada de dado pessoal. */
final readonly class LeadStatusChanged
{
    public function __construct(
        public int $leadId,
        public LeadType $type,
        public LeadStatus $from,
        public LeadStatus $to,
        public int $actorId,
    ) {}
}
