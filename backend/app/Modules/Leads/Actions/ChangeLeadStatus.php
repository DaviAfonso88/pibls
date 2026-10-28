<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Leads\Enums\LeadStatus;
use App\Shared\Http\BusinessRuleException;

/**
 * Confere a mudança de status do atendimento (CAP-10, BR-008). Só as transições da tabela valem; as demais, inclusive
 * "continuar no mesmo status", respondem 409 `INVALID_STATUS_TRANSITION`.
 */
final class ChangeLeadStatus
{
    public function __invoke(LeadStatus $from, LeadStatus $to): LeadStatus
    {
        if (! $from->canTransitionTo($to)) {
            throw new BusinessRuleException('INVALID_STATUS_TRANSITION', __('business.BR-008'));
        }

        return $to;
    }
}
