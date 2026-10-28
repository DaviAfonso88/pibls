<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Models\User;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * As inscrições feitas hoje (dia de Brasília), das mais novas para as mais antigas, para o Início do painel. Quem lê
 * inscritos de qualquer ministério vê todas; quem só tem `.own`, as dos eventos do próprio ministério (BR-030).
 */
final class ListTodayRegistrations
{
    public const LIMIT = 10;

    private const TIMEZONE = 'America/Sao_Paulo';

    public function __construct(private readonly PermissionGate $gate) {}

    /**
     * @return array{registrations: Collection<int, EventRegistration>, total: int}
     */
    public function __invoke(User $user, ?Carbon $now = null): array
    {
        $start = ($now ?? now())->copy()->timezone(self::TIMEZONE)->startOfDay();

        $query = EventRegistration::query()
            ->where('created_at', '>=', $start->copy()->utc())
            ->where('created_at', '<', $start->copy()->addDay()->utc());

        if (! $this->gate->allows($user, PermissionKey::EventosInscricoesRead)) {
            $this->ownMinistry($query, $user);
        }

        return [
            'total' => $query->count(),
            'registrations' => $query->with('event:id,title')->latest('created_at')->latest('id')->limit(self::LIMIT)->get(),
        ];
    }

    /**
     * @param  Builder<EventRegistration>  $query
     */
    private function ownMinistry(Builder $query, User $user): void
    {
        $query->whereHas('event', fn (Builder $event) => $event->where('ministry_id', $user->ministry_id));
    }
}
