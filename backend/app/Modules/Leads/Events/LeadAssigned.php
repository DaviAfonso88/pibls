<?php

declare(strict_types=1);

namespace App\Modules\Leads\Events;

use App\Modules\Leads\Enums\LeadType;

/** O responsável por um contato mudou (domínio: Leads). `assigneeId` nulo = ficou sem responsável. */
final readonly class LeadAssigned
{
    public function __construct(
        public int $leadId,
        public LeadType $type,
        public ?int $assigneeId,
        public int $actorId,
    ) {}
}
