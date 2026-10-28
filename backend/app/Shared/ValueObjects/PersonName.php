<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Illuminate\Support\Str;
use Stringable;

/**
 * Nome de pessoa: de 2 a 120 caracteres, com pelo menos uma letra. Guardado sem espaços nas pontas e com os espaços
 * internos colapsados. A forma normalizada (minúsculas, sem acentos) serve para comparar nomes (BR-022).
 */
final readonly class PersonName implements Stringable
{
    public const MIN_LENGTH = 2;

    public const MAX_LENGTH = 120;

    private function __construct(private string $value) {}

    public static function from(string $value): self
    {
        $clean = trim((string) preg_replace('/\s+/u', ' ', $value));
        $length = mb_strlen($clean);

        if ($length < self::MIN_LENGTH || $length > self::MAX_LENGTH || preg_match('/\p{L}/u', $clean) !== 1) {
            throw new InvalidValueObject('invalid_name', 'Informe seu nome.');
        }

        return new self($clean);
    }

    public static function tryFrom(?string $value): ?self
    {
        if ($value === null) {
            return null;
        }

        try {
            return self::from($value);
        } catch (InvalidValueObject) {
            return null;
        }
    }

    public function value(): string
    {
        return $this->value;
    }

    /** `José  da Conceição` → `jose da conceicao`. */
    public function normalized(): string
    {
        return Str::of($this->value)->ascii()->lower()->squish()->toString();
    }

    public function equals(self $other): bool
    {
        return $this->normalized() === $other->normalized();
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
