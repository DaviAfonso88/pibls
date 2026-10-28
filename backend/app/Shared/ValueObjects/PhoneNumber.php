<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Stringable;

/**
 * Telefone brasileiro: 10 ou 11 dígitos depois de remover a máscara, DDD entre 11 e 99 (BR-004).
 * Aceita também o prefixo do país (`+55`). Guardado em E.164 (`+5531999998888`) e exibido como `(31) 99999-8888`.
 */
final readonly class PhoneNumber implements Stringable
{
    private function __construct(private string $national) {}

    public static function from(string $value): self
    {
        $digits = (string) preg_replace('/\D+/', '', $value);

        // 12 ou 13 dígitos só cabem com o DDI: nenhum número nacional (DDD + 8 ou 9 dígitos) passa de 11
        if (in_array(strlen($digits), [12, 13], true) && str_starts_with($digits, '55')) {
            $digits = substr($digits, 2);
        }

        if (! in_array(strlen($digits), [10, 11], true)) {
            throw new InvalidValueObject('invalid_phone', 'O telefone precisa ter 10 ou 11 dígitos, com DDD.');
        }

        $ddd = (int) substr($digits, 0, 2);
        if ($ddd < 11 || $ddd > 99) {
            throw new InvalidValueObject('invalid_phone', 'O DDD precisa estar entre 11 e 99.');
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

    /** `+5531999998888`: a forma gravada no banco. */
    public function e164(): string
    {
        return '+55'.$this->national;
    }

    /** Só os dígitos nacionais (DDD + número). */
    public function digits(): string
    {
        return $this->national;
    }

    public function ddd(): string
    {
        return substr($this->national, 0, 2);
    }

    /** `(31) 99999-8888` (11 dígitos) ou `(31) 3688-1234` (10 dígitos). */
    public function formatted(): string
    {
        $number = substr($this->national, 2);
        $split = strlen($number) - 4;

        return sprintf('(%s) %s-%s', $this->ddd(), substr($number, 0, $split), substr($number, $split));
    }

    public function equals(self $other): bool
    {
        return $this->national === $other->national;
    }

    public function __toString(): string
    {
        return $this->e164();
    }
}
