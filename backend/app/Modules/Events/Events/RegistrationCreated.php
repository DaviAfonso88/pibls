<?php

declare(strict_types=1);

namespace App\Modules\Events\Events;

/**
 * Uma inscrição foi gravada (domínio: Events). Emitido dentro da transação do `RegisterForEvent`; o listener grava a
 * confirmação na fila de e-mails na mesma transação (ADR-003). Leva só identificadores: nada de dado pessoal.
 */
final readonly class RegistrationCreated
{
    public function __construct(
        public int $registrationId,
    ) {}
}
