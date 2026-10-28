<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use App\Modules\Access\Models\User;
use App\Modules\Events\Enums\EventState;
use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Platform\Files\UploadStore;
use Carbon\CarbonInterface;
use Database\Factories\EventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Evento (R2). O módulo fica desligado por `FEATURE_EVENTS`, mas o schema existe desde a F0-06.
 * Os estados (rascunho, inscrições abertas ou encerradas, realizado) são derivados, não gravados.
 *
 * @property int $id
 * @property string $title
 * @property string $slug
 * @property int $ministry_id
 * @property string $description
 * @property string $excerpt
 * @property Carbon $starts_at
 * @property Carbon|null $ends_at
 * @property string $location
 * @property string|null $banner_path
 * @property int|null $max_spots
 * @property Carbon|null $registration_deadline
 * @property bool $has_minors
 * @property bool $is_published
 * @property array<int, array<string, mixed>> $form_schema
 * @property Carbon|null $updated_at
 * @property-read MinistryGroup|null $ministry
 * @property-read User|null $updater
 * @property-read int|null $registrations_count
 */
#[UseFactory(EventFactory::class)]
#[Table(name: 'events')]
#[Fillable([
    'title', 'slug', 'ministry_id', 'description', 'excerpt', 'starts_at', 'ends_at', 'location', 'banner_path',
    'max_spots', 'registration_deadline', 'has_minors', 'is_published', 'form_schema', 'created_by', 'updated_by',
])]
class Event extends Model
{
    /** @use HasFactory<EventFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'registration_deadline' => 'datetime',
            'max_spots' => 'integer',
            'has_minors' => 'boolean',
            'is_published' => 'boolean',
            'form_schema' => 'array',
        ];
    }

    /** @return BelongsTo<MinistryGroup, $this> */
    public function ministry(): BelongsTo
    {
        return $this->belongsTo(MinistryGroup::class, 'ministry_id');
    }

    /** @return BelongsTo<User, $this> */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** @return HasMany<EventRegistration, $this> */
    public function registrations(): HasMany
    {
        return $this->hasMany(EventRegistration::class, 'event_id');
    }

    /**
     * O estado derivado do evento (data-model → Events), na ordem em que as regras se sobrepõem: rascunho; realizado
     * (passou o término, ou o início se não há término); encerrado por já ter começado, por prazo vencido ou por vagas
     * esgotadas; senão, inscrições abertas.
     */
    public function stateAt(CarbonInterface $now, int $registrations): EventState
    {
        if (! $this->is_published) {
            return EventState::Draft;
        }

        if (($this->ends_at ?? $this->starts_at)->lessThan($now)) {
            return EventState::Held;
        }

        $closed = $this->starts_at->lessThanOrEqualTo($now)
            || ($this->registration_deadline !== null && $this->registration_deadline->lessThanOrEqualTo($now))
            || ($this->max_spots !== null && $registrations >= $this->max_spots);

        return $closed ? EventState::RegistrationClosed : EventState::RegistrationOpen;
    }

    /** Vagas que sobram; `null` = ilimitadas. */
    public function spotsLeft(int $registrations): ?int
    {
        return $this->max_spots === null ? null : max(0, $this->max_spots - $registrations);
    }

    /** `/uploads/eventos/AAAA/<hex>.webp` (1600 px), ou `null` sem banner. */
    public function bannerUrl(): ?string
    {
        return $this->banner_path === null ? null : '/uploads/'.ltrim($this->banner_path, '/');
    }

    /** A variante de 800 px, para as listas. */
    public function bannerSmallUrl(): ?string
    {
        return $this->banner_path === null ? null : '/uploads/'.ltrim(UploadStore::smallVariantOf($this->banner_path), '/');
    }

    /**
     * Filtra pelo estado derivado, com a mesma regra de `stateAt` em SQL (a lista do painel pagina no banco).
     *
     * @param  Builder<Event>  $query
     */
    public function scopeInState(Builder $query, EventState $state, CarbonInterface $now): void
    {
        $at = $now->copy()->utc()->format('Y-m-d H:i:s');

        // SQL cru só com literais e bindings (regra de arquitetura): a subconsulta é a mesma de `withCount('registrations')`
        match ($state) {
            EventState::Draft => $query->where('is_published', false),
            EventState::Held => $query->where('is_published', true)->whereRaw('coalesce(ends_at, starts_at) < ?', [$at]),
            EventState::RegistrationOpen => $query->where('is_published', true)
                ->whereRaw('coalesce(ends_at, starts_at) >= ?', [$at])
                ->where('starts_at', '>', $at)
                ->where(fn (Builder $inner) => $inner->whereNull('registration_deadline')->orWhere('registration_deadline', '>', $at))
                ->where(fn (Builder $inner) => $inner->whereNull('max_spots')
                    ->orWhereRaw('(select count(*) from event_registrations where event_registrations.event_id = events.id) < max_spots')),
            EventState::RegistrationClosed => $query->where('is_published', true)
                ->whereRaw('coalesce(ends_at, starts_at) >= ?', [$at])
                ->where(fn (Builder $inner) => $inner->where('starts_at', '<=', $at)
                    ->orWhere(fn (Builder $deadline) => $deadline->whereNotNull('registration_deadline')->where('registration_deadline', '<=', $at))
                    ->orWhere(fn (Builder $full) => $full->whereNotNull('max_spots')
                        ->whereRaw('(select count(*) from event_registrations where event_registrations.event_id = events.id) >= max_spots'))),
        };
    }
}
