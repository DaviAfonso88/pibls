<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use InvalidArgumentException;

/**
 * Valor que não cumpre a regra do Value Object. O `reason` é o código estável (`invalid_phone`, `invalid_cnpj`…)
 * que as regras de validação dos Form Requests transformam na mensagem pt-BR da BR correspondente.
 */
final class InvalidValueObject extends InvalidArgumentException
{
    public function __construct(public readonly string $reason, string $message = '')
    {
        parent::__construct($message !== '' ? $message : $reason);
    }
}
