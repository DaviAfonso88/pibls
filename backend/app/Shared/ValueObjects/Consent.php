<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Consentimento do titular: só existe se `accepted = true` (BR-001). Guarda o momento (UTC) e a versão vigente da
 * Política de Privacidade (BR-082), que viram `consent_at` e `consent_version` no contato ou na inscrição.
 */
final readonly class Consent
{
    private function __construct(
        public CarbonImmutable $at,
        public string $version,
    ) {}

    public static function given(bool $accepted, string $version, ?DateTimeInterface $at = null): self
    {
        if (! $accepted) {
            throw new InvalidValueObject(
                'consent_required',
                'Para enviar, você precisa concordar com a Política de Privacidade.',
            );
        }

        return new self(
            $at === null ? CarbonImmutable::now('UTC') : CarbonImmutable::instance($at)->utc(),
            $version,
        );
    }

    /**
     * @return array{consent_at: string, consent_version: string}
     */
    public function toAttributes(): array
    {
        return [
            'consent_at' => $this->at->format('Y-m-d H:i:s'),
            'consent_version' => $this->version,
        ];
    }
}
