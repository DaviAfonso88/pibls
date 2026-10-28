<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Illuminate\Support\Str;
use Stringable;

/**
 * Endereço amigável: `^[a-z0-9]+(-[a-z0-9]+)*$`, até 160 caracteres (BR-032).
 */
final readonly class Slug implements Stringable
{
    public const MAX_LENGTH = 160;

    private const PATTERN = '/^[a-z0-9]+(-[a-z0-9]+)*$/';

    private function __construct(private string $value) {}

    public static function from(string $value): self
    {
        if (strlen($value) > self::MAX_LENGTH || preg_match(self::PATTERN, $value) !== 1) {
            throw new InvalidValueObject('invalid_slug', 'Use só letras minúsculas, números e hífens.');
        }

        return new self($value);
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

    /** Sugestão a partir do título: `Graça e Paz!` → `graca-e-paz`. Sem letras nem números, não há slug. */
    public static function fromTitle(string $title): self
    {
        $slug = trim(substr(Str::slug($title), 0, self::MAX_LENGTH), '-');

        if ($slug === '') {
            throw new InvalidValueObject('invalid_slug', 'O título não tem letras nem números para formar o endereço.');
        }

        return new self($slug);
    }

    public function value(): string
    {
        return $this->value;
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
