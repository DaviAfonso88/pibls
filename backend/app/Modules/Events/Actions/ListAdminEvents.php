<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Models\User;
use App\Modules\Events\Enums\EventState;
use App\Modules\Events\Models\Event;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * A lista de eventos do painel (CAP-12), com o total de inscritos de cada um. Quem escreve ou lê inscritos de qualquer
 * ministério vê todos; quem só tem `.own` vê os do próprio ministério, e os demais nem aparecem (BR-030).
 */
final class ListAdminEvents
{
    public const DEFAULT_PER_PAGE = 20;

    public function __construct(private readonly PermissionGate $gate) {}

    /**
     * @param  string  $sort  `-starts_at` (os mais distantes primeiro) ou `starts_at`
     * @return LengthAwarePaginator<int, Event>
     */
    public function __invoke(User $user, int $page, int $perPage, ?EventState $state, ?int $ministryId, string $sort): LengthAwarePaginator
    {
        $query = Event::query()
            ->with(['ministry:id,name', 'updater:id,name'])
            ->withCount('registrations');

        if (! $this->seesAll($user)) {
            $query->where('ministry_id', $user->ministry_id);
        }

        if ($ministryId !== null) {
            $query->where('ministry_id', $ministryId);
        }

        if ($state !== null) {
            $query->inState($state, now());
        }

        $direction = $sort === 'starts_at' ? 'asc' : 'desc';

        return $query
            ->orderBy('starts_at', $direction)
            ->orderBy('id', $direction)
            ->paginate(perPage: $perPage, page: $page);
    }

    private function seesAll(User $user): bool
    {
        return $this->gate->allows($user, PermissionKey::EventosWrite)
            || $this->gate->allows($user, PermissionKey::EventosInscricoesRead);
    }
}
