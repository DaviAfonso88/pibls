<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Resources;

use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `MinistryAdmin` (contracts/openapi.yaml): o item público mais o que só o painel vê (endereço residencial, e-mail de
 * contato, ordem, estado e quem alterou por último). Os campos internos só saem aqui, nunca pela API pública (BR-048).
 *
 * @mixin MinistryGroup
 */
final class MinistryAdminResource extends JsonResource
{
    public function __construct(MinistryGroup $resource, private readonly ?string $updaterName = null)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...(new PublicMinistryResource($this->resource))->toArray($request),
            'private_address' => $this->private_address,
            'contact_email' => $this->contact_email,
            'display_order' => $this->display_order,
            'is_active' => $this->is_active,
            'updated_at' => $this->updated_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'updated_by' => $this->updated_by === null ? null : ['id' => $this->updated_by, 'name' => $this->updaterName],
        ];
    }
}
