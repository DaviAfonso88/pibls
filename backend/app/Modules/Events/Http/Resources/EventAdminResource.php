<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\Event;
use Illuminate\Http\Request;

/**
 * `EventAdmin` (contracts/openapi.yaml): o detalhe mais o que só o painel precisa (publicação, vagas e prazo gravados, total
 * de inscritos e quem alterou por último).
 *
 * @mixin Event
 */
final class EventAdminResource extends EventDetailResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'is_published' => $this->is_published,
            'max_spots' => $this->max_spots,
            'registration_deadline' => self::instant($this->registration_deadline),
            'registrations_count' => $this->registrationsCount(),
            'updated_at' => self::instant($this->updated_at),
            'updated_by' => $this->updater === null ? null : ['id' => $this->updater->getKey(), 'name' => $this->updater->name],
        ];
    }
}
