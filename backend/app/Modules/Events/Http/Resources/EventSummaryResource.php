<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\Event;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `EventSummary` (contracts/openapi.yaml): o evento como aparece nas listas e na página inicial. Só dado público: o
 * ministério vem como `{id, name}`, nunca com endereço residencial nem e-mail de contato (BR-048, BR-050).
 *
 * @mixin Event
 */
class EventSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => $this->excerpt,
            'ministry' => $this->ministry === null ? null : ['id' => $this->ministry->getKey(), 'name' => $this->ministry->name],
            'starts_at' => self::instant($this->starts_at),
            'ends_at' => self::instant($this->ends_at),
            'location' => $this->location,
            'banner_small_url' => $this->bannerSmallUrl(),
            'registration' => $this->registration(),
        ];
    }

    /**
     * `EventRegistrationInfo`: o estado derivado, o prazo e as vagas.
     *
     * @return array{state: string, deadline: string|null, spots_total: int|null, spots_left: int|null}
     */
    protected function registration(): array
    {
        $count = $this->registrationsCount();

        return [
            'state' => $this->resource->stateAt(now(), $count)->value,
            'deadline' => self::instant($this->registration_deadline),
            'spots_total' => $this->max_spots,
            'spots_left' => $this->resource->spotsLeft($count),
        ];
    }

    /** O total vem de `withCount('registrations')` quando a lista o pediu; senão, uma contagem. */
    protected function registrationsCount(): int
    {
        return (int) ($this->resource->registrations_count ?? $this->resource->registrations()->count());
    }

    public static function instant(?CarbonInterface $moment): ?string
    {
        return $moment?->copy()->utc()->format('Y-m-d\TH:i:s\Z');
    }
}
