<?php

declare(strict_types=1);

namespace App\Modules\Access\Rules;

use App\Modules\Access\Security\PwnedPasswords;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Política de senha (BR-073): mínimo de 12 caracteres, no máximo 72 bytes (limite do bcrypt), sem regras de composição
 * e fora da base de senhas vazadas. Cada violação responde com a frase da própria regra. A consulta à base de vazamentos
 * só acontece se as duas primeiras passarem.
 */
final class StrongPassword implements ValidationRule
{
    public const MIN_CHARACTERS = 12;

    public const MAX_BYTES = 72;

    public function __construct(private readonly PwnedPasswords $pwned) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || mb_strlen($value) < self::MIN_CHARACTERS) {
            $fail(__('business.BR-073.0'));

            return;
        }

        if (strlen($value) > self::MAX_BYTES) {
            $fail(__('business.BR-073.1'));

            return;
        }

        if ($this->pwned->appearsInBreach($value)) {
            $fail(__('business.BR-073.2'));
        }
    }
}
