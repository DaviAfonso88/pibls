<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Resources;

use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `MinistryPublic` (contracts/openapi.yaml). Lista branca de campos: nunca `private_address` nem `contact_email`
 * (BR-048, BR-050), mesmo que um dia o model deixe de escondê-los.
 *
 * @mixin MinistryGroup
 */
final class PublicMinistryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'category' => $this->category,
            'name' => $this->name,
            'description' => $this->description,
            'leaders_text' => $this->leaders_text,
            'schedule_text' => $this->schedule_text,
            'neighborhood' => $this->neighborhood,
            'contact_phone' => $this->contact_phone,
        ];
    }
}
