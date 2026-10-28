<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Resources;

use App\Modules\Events\Models\EventRegistration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

/**
 * `TodayRegistration`: uma linha do bloco "Inscrições de hoje" do Início. Só o que a tabela mostra, com o nome abreviado
 * ("Pedro H.") para não levar dado pessoal além do necessário; o completo está na lista de inscritos do evento.
 *
 * @mixin EventRegistration
 */
final class TodayRegistrationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getKey(),
            'created_at' => EventSummaryResource::instant($this->created_at),
            'name' => self::abbreviate($this->participant_name),
            'event' => ['id' => $this->event->getKey(), 'title' => $this->event->title],
        ];
    }

    /** "Pedro Henrique Alves" → "Pedro A."; nome único fica como está. */
    public static function abbreviate(string $name): string
    {
        $parts = preg_split('/\s+/u', trim($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        if (count($parts) < 2) {
            return $parts[0] ?? '';
        }

        return $parts[0].' '.Str::upper(Str::substr($parts[count($parts) - 1], 0, 1)).'.';
    }
}
