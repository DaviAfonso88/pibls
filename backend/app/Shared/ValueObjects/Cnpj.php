<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Stringable;

/**
 * CNPJ: 14 dígitos com os dígitos verificadores válidos (BR-061). Guardado só com dígitos e exibido como
 * `00.000.000/0000-00`. A chave PIX da igreja é um CNPJ.
 */
final readonly class Cnpj implements Stringable
{
    private function __construct(private string $digits) {}

    public static function from(string $value): self
    {
        $digits = (string) preg_replace('/\D+/', '', $value);

        if (strlen($digits) !== 14
            // 00000000000000, 11111111111111…: passam na conta dos dígitos, mas não existem
            || preg_match('/^(\d)\1{13}$/', $digits) === 1
            || ! self::checkDigitsMatch($digits)) {
            throw new InvalidValueObject('invalid_cnpj', 'Informe um CNPJ válido.');
        }

        return new self($digits);
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

    public function digits(): string
    {
        return $this->digits;
    }

    /** `20.969.119/0001-84` */
    public function formatted(): string
    {
        return sprintf(
            '%s.%s.%s/%s-%s',
            substr($this->digits, 0, 2),
            substr($this->digits, 2, 3),
            substr($this->digits, 5, 3),
            substr($this->digits, 8, 4),
            substr($this->digits, 12, 2),
        );
    }

    public function equals(self $other): bool
    {
        return $this->digits === $other->digits;
    }

    public function __toString(): string
    {
        return $this->digits;
    }

    private static function checkDigitsMatch(string $digits): bool
    {
        $first = self::checkDigit(substr($digits, 0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
        $second = self::checkDigit(substr($digits, 0, 12).$first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

        return $digits[12] === (string) $first && $digits[13] === (string) $second;
    }

    /**
     * @param  list<int>  $weights
     */
    private static function checkDigit(string $base, array $weights): int
    {
        $sum = 0;
        foreach ($weights as $position => $weight) {
            $sum += (int) $base[$position] * $weight;
        }

        $remainder = $sum % 11;

        return $remainder < 2 ? 0 : 11 - $remainder;
    }
}
