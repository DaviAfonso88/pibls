<?php

declare(strict_types=1);

namespace App\Shared\Validation;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Consentimento da Política de Privacidade (BR-001): o valor precisa ser o booleano `true`. Texto como "sim" ou o
 * número 1 não valem: o formulário envia o marcador de verdade.
 */
final class ConsentGiven implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if ($value !== true) {
            $fail(__('business.BR-001'));
        }
    }
}
