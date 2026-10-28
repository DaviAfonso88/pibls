<?php

declare(strict_types=1);

namespace App\Shared\Validation;

use App\Shared\ValueObjects\PersonName;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** Nome de pessoa: 2 a 120 caracteres, com pelo menos uma letra (BR-004). */
final class ValidPersonName implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || PersonName::tryFrom($value) === null) {
            $fail(__('business.BR-004.0'));
        }
    }
}
