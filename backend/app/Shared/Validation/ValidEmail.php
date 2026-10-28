<?php

declare(strict_types=1);

namespace App\Shared\Validation;

use App\Shared\ValueObjects\EmailAddress;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** E-mail válido, até 254 caracteres (BR-004). */
final class ValidEmail implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || EmailAddress::tryFrom($value) === null) {
            $fail(__('business.BR-004.2'));
        }
    }
}
