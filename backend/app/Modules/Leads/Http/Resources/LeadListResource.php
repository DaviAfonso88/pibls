<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Resources;

use App\Modules\Leads\Models\Lead;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Item da lista de uma caixa (`LeadListItem`). Nunca leva a mensagem: ela só aparece no detalhe (BR-007, ADR-016).
 * `waiting_days` só vem em contato `NOVO` há mais de 3 dias (BR-010); `assigned_to.is_active` falso vira "(inativo)" na
 * tela (BR-012).
 *
 * @mixin Lead
 */
class LeadListResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'status' => $this->status,
            'name' => $this->name,
            'phone' => $this->phone,
            'created_at' => $this->created_at?->utc()->toIso8601ZuluString(),
            'waiting_days' => $this->waitingDays(),
            'assigned_to' => $this->assignee === null ? null : [
                'id' => $this->assignee->getKey(),
                'name' => $this->assignee->name,
                'is_active' => $this->assignee->is_active,
            ],
        ];
    }
}
