<?php

declare(strict_types=1);

namespace App\Shared\Http;

use RuntimeException;

/**
 * Bloqueio temporário por regra de negócio (429), com o texto da própria regra em vez do genérico do limitador:
 * o login bloqueado da BR-071. `retryAfter` (segundos) vai no cabeçalho `Retry-After`.
 */
final class TooManyAttemptsException extends RuntimeException
{
    public function __construct(string $message, public readonly int $retryAfter)
    {
        parent::__construct($message);
    }
}
