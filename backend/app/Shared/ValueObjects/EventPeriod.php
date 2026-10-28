<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

use Carbon\CarbonImmutable;
use DateTimeInterface;

/**
 * Período de um evento: `ends_at`, quando informado, não pode ser anterior a `starts_at` (BR-025).
 * Os dois instantes são mantidos em UTC.
 */
final readonly class EventPeriod
{
    private function __construct(
        public CarbonImmutable $startsAt,
        public ?CarbonImmutable $endsAt,
    ) {}

    public static function of(DateTimeInterface $startsAt, ?DateTimeInterface $endsAt = null): self
    {
        $start = CarbonImmutable::instance($startsAt)->utc();
        $end = $endsAt === null ? null : CarbonImmutable::instance($endsAt)->utc();

        if ($end !== null && $end->lessThan($start)) {
            throw new InvalidValueObject('invalid_event_period', 'O término precisa ser depois do início.');
        }

        return new self($start, $end);
    }

    /** `coalesce(ends_at, starts_at)`: quando o evento acaba para efeito de "realizado". */
    public function effectiveEnd(): CarbonImmutable
    {
        return $this->endsAt ?? $this->startsAt;
    }

    public function hasStarted(DateTimeInterface $now): bool
    {
        return $this->startsAt->lessThanOrEqualTo($now);
    }

    public function hasEnded(DateTimeInterface $now): bool
    {
        return $this->effectiveEnd()->lessThan($now);
    }
}
