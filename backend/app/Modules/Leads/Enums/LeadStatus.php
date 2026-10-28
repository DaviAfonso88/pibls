<?php

declare(strict_types=1);

namespace App\Modules\Leads\Enums;

/** Situação do atendimento (máquina de estados do CAP-10). Todo contato nasce `NOVO`. */
enum LeadStatus: string
{
    case Novo = 'NOVO';
    case EmAtendimento = 'EM_ATENDIMENTO';
    case Concluido = 'CONCLUIDO';

    /**
     * Transições permitidas (CAP-10, BR-008): NOVO → EM_ATENDIMENTO ou CONCLUIDO; EM_ATENDIMENTO → CONCLUIDO ou de volta a
     * NOVO (devolver à fila); CONCLUIDO → EM_ATENDIMENTO (reabrir). Qualquer outra, inclusive "continuar no mesmo", não.
     */
    public function canTransitionTo(self $to): bool
    {
        return match ($this) {
            self::Novo => in_array($to, [self::EmAtendimento, self::Concluido], true),
            self::EmAtendimento => in_array($to, [self::Concluido, self::Novo], true),
            self::Concluido => $to === self::EmAtendimento,
        };
    }
}
