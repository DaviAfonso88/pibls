<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\EventRegistration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `EventRegistrationAdmin` (contracts/openapi.yaml): uma inscrição com os campos fixos e as respostas (rótulo da época), só
 * para o painel. Telefone em E.164, como gravado.
 *
 * @mixin EventRegistration
 */
final class EventRegistrationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getKey(),
            'created_at' => EventSummaryResource::instant($this->created_at),
            'participant_name' => $this->participant_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'guardian_name' => $this->guardian_name,
            'guardian_phone' => $this->guardian_phone,
            'answers' => array_values($this->answers),
        ];
    }
}
