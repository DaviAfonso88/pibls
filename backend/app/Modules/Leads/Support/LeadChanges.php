<?php

declare(strict_types=1);

namespace App\Modules\Leads\Support;

use App\Modules\Leads\Enums\LeadStatus;

/**
 * O que o `PATCH /api/admin/leads/{id}` pede para mudar (CAP-10). `assigneeGiven` distingue "não mandou
 * responsável" de "mandou null".
 */
final readonly class LeadChanges
{
    public function __construct(
        public ?LeadStatus $status = null,
        public bool $assigneeGiven = false,
        public ?int $assigneeId = null,
        public ?string $note = null,
    ) {}
}
