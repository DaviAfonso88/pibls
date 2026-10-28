<?php

declare(strict_types=1);

namespace App\Shared\ValueObjects;

/**
 * Uma linha do quadro de horários (`site_settings.schedule`): dia ou recorrência, atividade, horário `HH:MM` e
 * modalidade. A configuração aceita até 20 itens (Domain Model → Value Objects).
 */
final readonly class ScheduleItem
{
    public const MAX_ITEMS = 20;

    private function __construct(
        public string $day,
        public string $recurrence,
        public string $activity,
        public string $time,
        public string $mode,
    ) {}

    /**
     * @param  array<string, mixed>  $data  `day`, `recurrence`, `activity`, `time`, `mode`
     */
    public static function from(array $data): self
    {
        return new self(
            self::text($data['day'] ?? null, 60, 'o dia'),
            self::text($data['recurrence'] ?? null, 60, 'a recorrência'),
            self::text($data['activity'] ?? null, 120, 'a atividade'),
            self::time($data['time'] ?? null),
            self::text($data['mode'] ?? null, 120, 'a modalidade'),
        );
    }

    /**
     * @param  array<int, array<string, mixed>>  $items
     * @return list<self>
     */
    public static function listFrom(array $items): array
    {
        if (count($items) > self::MAX_ITEMS) {
            throw new InvalidValueObject('too_many_schedule_items', 'O quadro de horários pode ter no máximo 20 itens.');
        }

        return array_map(self::from(...), array_values($items));
    }

    /**
     * @return array{day: string, recurrence: string, activity: string, time: string, mode: string}
     */
    public function toArray(): array
    {
        return [
            'day' => $this->day,
            'recurrence' => $this->recurrence,
            'activity' => $this->activity,
            'time' => $this->time,
            'mode' => $this->mode,
        ];
    }

    private static function text(mixed $value, int $max, string $label): string
    {
        $text = is_string($value) ? trim((string) preg_replace('/\s+/u', ' ', $value)) : '';

        if ($text === '' || mb_strlen($text) > $max) {
            throw new InvalidValueObject('invalid_schedule_item', "Informe {$label} (até {$max} caracteres).");
        }

        return $text;
    }

    private static function time(mixed $value): string
    {
        if (! is_string($value) || preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $value) !== 1) {
            throw new InvalidValueObject('invalid_schedule_item', 'Informe o horário no formato HH:MM.');
        }

        return $value;
    }
}
