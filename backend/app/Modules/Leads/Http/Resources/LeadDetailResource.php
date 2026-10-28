<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Resources;

use App\Modules\Leads\Models\Lead;
use Illuminate\Http\Request;

/**
 * Detalhe de um contato (`LeadDetail`): todos os campos, a mensagem já decifrada, o histórico de atendimento e o link
 * "Responder no WhatsApp" quando há telefone. Só chega a quem pode LER o tipo do contato (BR-007).
 *
 * @mixin Lead
 */
final class LeadDetailResource extends LeadListResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'email' => $this->email,
            'neighborhood' => $this->neighborhood,
            'wants_visit' => $this->wants_visit,
            'wants_cell_group' => $this->wants_cell_group,
            'group' => $this->group === null ? null : ['id' => $this->group->getKey(), 'name' => $this->group->name],
            'from_other_baptist_church' => $this->from_other_baptist_church,
            'ministry' => $this->ministry === null ? null : ['id' => $this->ministry->getKey(), 'name' => $this->ministry->name],
            'message' => $this->message,
            'consent_at' => $this->consent_at->utc()->toIso8601ZuluString(),
            'consent_version' => $this->consent_version,
            'whatsapp_url' => $this->phone === null ? null : 'https://wa.me/'.ltrim($this->phone, '+'),
            'activities' => $this->activities->map(fn ($activity) => [
                'id' => $activity->id,
                'actor' => ['id' => $activity->actor->getKey(), 'name' => $activity->actor->name],
                'from_status' => $activity->from_status,
                'to_status' => $activity->to_status,
                'assigned_to' => $activity->assigned_to,
                'note' => $activity->note,
                'created_at' => $activity->created_at->utc()->toIso8601ZuluString(),
            ])->all(),
        ];
    }
}
