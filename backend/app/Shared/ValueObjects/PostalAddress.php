<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

/**
 * Endereço postal da igreja (`site_settings.address`): logradouro, número, complemento, bairro, cidade, UF e CEP com
 * 8 dígitos. O endereço residencial das Células de CL NÃO é um `PostalAddress`: é texto cifrado e nunca público (BR-048).
 */
final readonly class PostalAddress
{
    private const STATES = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
        'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
    ];

    private function __construct(
        public string $street,
        public string $number,
        public ?string $complement,
        public string $neighborhood,
        public string $city,
        public string $state,
        public string $zip,
    ) {}

    /**
     * @param  array<string, mixed>  $data  `street`, `number`, `complement`, `neighborhood`, `city`, `state`, `zip`
     */
    public static function from(array $data): self
    {
        $zip = (string) preg_replace('/\D+/', '', is_string($data['zip'] ?? null) ? $data['zip'] : '');
        if (strlen($zip) !== 8) {
            throw new InvalidValueObject('invalid_zip', 'Informe um CEP com 8 dígitos.');
        }

        $state = strtoupper(trim(is_string($data['state'] ?? null) ? $data['state'] : ''));
        if (! in_array($state, self::STATES, true)) {
            throw new InvalidValueObject('invalid_state', 'Informe a sigla do estado (UF).');
        }

        return new self(
            self::required($data['street'] ?? null, 120, 'o logradouro'),
            self::required($data['number'] ?? null, 20, 'o número'),
            self::optional($data['complement'] ?? null, 60),
            self::required($data['neighborhood'] ?? null, 80, 'o bairro'),
            self::required($data['city'] ?? null, 80, 'a cidade'),
            $state,
            $zip,
        );
    }

    /** `Rua das Flores, 123, Sala 2 - Centro, Lagoa Santa/MG - CEP 33400-000` */
    public function formatted(): string
    {
        $line = $this->street.', '.$this->number;
        if ($this->complement !== null) {
            $line .= ', '.$this->complement;
        }

        return sprintf(
            '%s - %s, %s/%s - CEP %s',
            $line,
            $this->neighborhood,
            $this->city,
            $this->state,
            substr($this->zip, 0, 5).'-'.substr($this->zip, 5),
        );
    }

    /**
     * @return array{street: string, number: string, complement: string|null, neighborhood: string, city: string, state: string, zip: string}
     */
    public function toArray(): array
    {
        return [
            'street' => $this->street,
            'number' => $this->number,
            'complement' => $this->complement,
            'neighborhood' => $this->neighborhood,
            'city' => $this->city,
            'state' => $this->state,
            'zip' => $this->zip,
        ];
    }

    private static function required(mixed $value, int $max, string $label): string
    {
        $text = self::optional($value, $max);

        if ($text === null) {
            throw new InvalidValueObject('invalid_address', "Informe {$label}.");
        }

        return $text;
    }

    private static function optional(mixed $value, int $max): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $text = trim((string) preg_replace('/\s+/u', ' ', $value));

        if ($text === '') {
            return null;
        }

        if (mb_strlen($text) > $max) {
            throw new InvalidValueObject('invalid_address', "O texto pode ter no máximo {$max} caracteres.");
        }

        return $text;
    }
}
