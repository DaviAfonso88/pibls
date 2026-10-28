<?php

declare(strict_types=1);

namespace App\Shared\Http;

use RuntimeException;

/**
 * Violação de regra de negócio ou de estado: responde 409 com o código específico da BR
 * (API Standards → Códigos de regra de negócio), por exemplo `EVENT_FULL` ou `ITEM_IN_USE`.
 * O `message` já é o texto pt-BR da regra, exibido ao usuário.
 */
final class BusinessRuleException extends RuntimeException
{
    /**
     * @param  list<array{field?: string, code?: string, message: string}>  $details
     */
    public function __construct(
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }
}
