<?php

declare(strict_types=1);

namespace App\Poc\Http;

use App\Poc\Models\PocMinistryGroup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * PoC F0-03 (T013). REMOVER na T015.
 *
 * @mixin PocMinistryGroup
 */
final class GroupResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'neighborhood' => $this->neighborhood,
            'category' => $this->getAttribute('category'),
        ];
    }
}
