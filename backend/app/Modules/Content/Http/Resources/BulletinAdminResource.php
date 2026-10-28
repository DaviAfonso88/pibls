<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use App\Modules\Content\Models\Bulletin;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `BulletinAdmin` (contracts/openapi.yaml): o boletim público mais o que só o painel vê (quando sai, o estado e quem
 * alterou por último).
 *
 * @mixin Bulletin
 */
final class BulletinAdminResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...(new BulletinPublicResource($this->resource))->toArray($request),
            'published_at' => $this->published_at->utc()->format('Y-m-d\TH:i:s\Z'),
            'status' => $this->status()->value,
            'updated_at' => $this->updated_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'updated_by' => $this->updater === null ? null : ['id' => $this->updater->getKey(), 'name' => $this->updater->name],
        ];
    }
}
