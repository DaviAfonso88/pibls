<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Stringable;

/**
 * Código "Pix Copia e Cola": payload EMV (BR Code) com CRC16 válido, até 512 caracteres (BR-062).
 *
 * O payload é uma sequência de campos `TTLLvalor` (tag de 2 dígitos, tamanho de 2 dígitos). O primeiro é
 * `000201` (indicador de formato) e o último é `6304` seguido dos 4 caracteres hexadecimais do CRC16-CCITT
 * (polinômio 0x1021, valor inicial 0xFFFF), calculado sobre tudo que vem antes dos 4 últimos caracteres.
 */
final readonly class PixCopyPasteCode implements Stringable
{
    public const MAX_LENGTH = 512;

    private function __construct(private string $value) {}

    public static function from(string $value): self
    {
        $code = trim($value);

        if (! self::isWellFormed($code) || ! self::crcMatches($code)) {
            throw new InvalidValueObject(
                'invalid_pix_code',
                'O código Pix Copia e Cola é inválido. Copie-o novamente do aplicativo do banco.',
            );
        }

        return new self($code);
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

    /** CRC16-CCITT-FALSE em hexadecimal maiúsculo, 4 caracteres. */
    public static function crc16(string $data): string
    {
        $crc = 0xFFFF;

        foreach (str_split($data) as $char) {
            $crc ^= ord($char) << 8;
            for ($bit = 0; $bit < 8; $bit++) {
                $crc = ($crc & 0x8000) !== 0 ? (($crc << 1) ^ 0x1021) & 0xFFFF : ($crc << 1) & 0xFFFF;
            }
        }

        return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
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

    private static function isWellFormed(string $code): bool
    {
        $length = strlen($code);

        if ($length === 0 || $length > self::MAX_LENGTH || ! str_starts_with($code, '000201')) {
            return false;
        }

        // Percorre os campos TTLLvalor até o fim; o último precisa ser o CRC (63 04 XXXX)
        $position = 0;
        $lastTagAt = 0;

        while ($position < $length) {
            if ($position + 4 > $length || ! ctype_digit(substr($code, $position, 4))) {
                return false;
            }

            $lastTagAt = $position;
            $position += 4 + (int) substr($code, $position + 2, 2);
        }

        return $position === $length
            && $lastTagAt === $length - 8
            && substr($code, $lastTagAt, 4) === '6304'
            && ctype_xdigit(substr($code, -4));
    }

    private static function crcMatches(string $code): bool
    {
        return self::crc16(substr($code, 0, -4)) === strtoupper(substr($code, -4));
    }
}
