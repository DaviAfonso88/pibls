<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Stringable;

/**
 * E-mail: RFC 5322, até 254 caracteres, guardado em minúsculas e sem espaços nas pontas (BR-004).
 */
final readonly class EmailAddress implements Stringable
{
    public const MAX_LENGTH = 254;

    private function __construct(private string $value) {}

    public static function from(string $value): self
    {
        $normalized = mb_strtolower(trim($value));

        if ($normalized === ''
            || strlen($normalized) > self::MAX_LENGTH
            || filter_var($normalized, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidValueObject('invalid_email', 'Informe um e-mail válido.');
        }

        return new self($normalized);
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

    public function domain(): string
    {
        return substr($this->value, (int) strrpos($this->value, '@') + 1);
    }

    public function equals(self $other): bool
    {
        return $this->value === $other->value;
    }

    public function __toString(): string
    {
        return $this->value;
    }
}
