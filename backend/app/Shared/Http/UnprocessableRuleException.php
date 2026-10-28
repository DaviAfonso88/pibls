<?php

declare(strict_types=1);

namespace App\Shared\Http;

use RuntimeException;

/**
 * Pedido recusado por uma regra de negócio que a API Standards responde com 422 e um código próprio, em vez do
 * `VALIDATION_ERROR` genérico: `INVALID_CREDENTIALS` (BR-070) e `INVALID_RESET_TOKEN` (BR-072).
 * O `message` já é o texto pt-BR da regra, exibido ao usuário.
 */
final class UnprocessableRuleException extends RuntimeException
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
