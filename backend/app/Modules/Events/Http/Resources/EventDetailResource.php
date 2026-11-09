<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\Event;
use Illuminate\Http\Request;

/**
 * `EventPublicDetail` (contracts/openapi.yaml): o resumo mais a descrição (HTML sanitizado), o banner grande, o aviso de
 * menores e o formulário de inscrição.
 *
 * @mixin Event
 */
class EventDetailResource extends EventSummaryResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'description' => $this->description,
            'banner_url' => $this->bannerUrl(),
            'has_minors' => $this->has_minors,
            // Os campos fixos que o formulário pede (ADR-025): o que estiver desligado não aparece na inscrição
            'asks_participant_name' => $this->asks_participant_name,
            'asks_phone' => $this->asks_phone,
            'asks_email' => $this->asks_email,
            'form_schema' => array_values($this->form_schema),
        ];
    }
}
