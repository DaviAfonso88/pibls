<?php

declare(strict_types=1);

namespace App\Modules\Events\Snapshots;

use App\Modules\Events\Http\Resources\EventSummaryResource;
use App\Modules\Events\Models\Event;
use App\Modules\Platform\Snapshots\SnapshotSection;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;

/**
 * `upcoming_events` da `home.json` (contracts/snapshots.md): até 3 próximos eventos publicados, os que ainda não
 * terminaram, do mais próximo ao mais distante, no mesmo formato da API pública (`EventSummary`). Com `FEATURE_EVENTS`
 * desligada a lista é sempre vazia.
 *
 * O tempo muda o resultado sozinho: um evento sai da lista quando termina, e o estado das inscrições (e a vaga que sobra)
 * muda quando o prazo vence ou o evento começa. O agendador pergunta aqui se algum desses instantes caiu no intervalo.
 */
final class UpcomingEventsSection implements SnapshotSection
{
    private const LIMIT = 3;

    public function snapshot(): string
    {
        return 'home';
    }

    public function key(): string
    {
        return 'upcoming_events';
    }

    public function build(): array
    {
        if (! $this->enabled()) {
            return [];
        }

        $events = Event::query()
            ->with('ministry:id,name')
            ->withCount('registrations')
            ->where('is_published', true)
            ->whereRaw('coalesce(ends_at, starts_at) >= ?', [now()->utc()->format('Y-m-d H:i:s')])
            ->orderBy('starts_at')
            ->orderBy('id')
            ->limit(self::LIMIT)
            ->get();

        return array_values(EventSummaryResource::collection($events)->resolve());
    }

    public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        $from = $since->copy()->utc()->format('Y-m-d H:i:s');
        $to = $until->copy()->utc()->format('Y-m-d H:i:s');

        return Event::query()
            ->where('is_published', true)
            ->where(function (Builder $query) use ($from, $to): void {
                // Intervalo (since, until]: aberto em `since`, fechado em `until`
                foreach (['starts_at', 'ends_at', 'registration_deadline'] as $column) {
                    $query->orWhere(fn (Builder $inside) => $inside->where($column, '>', $from)->where($column, '<=', $to));
                }
            })
            ->exists();
    }

    private function enabled(): bool
    {
        return config('features.events') === true;
    }
}
