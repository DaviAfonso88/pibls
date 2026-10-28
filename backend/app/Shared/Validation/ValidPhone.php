<?php

declare(strict_types=1);

namespace App\Shared\Validation;

use App\Shared\ValueObjects\PhoneNumber;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Telefone brasileiro com DDD (BR-004). A mensagem é a do documento. O nome da classe vira o `code` do erro
 * (`valid_phone`) no envelope.
 */
final class ValidPhone implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || PhoneNumber::tryFrom($value) === null) {
            $fail(__('business.BR-004.1'));
        }
    }
}
