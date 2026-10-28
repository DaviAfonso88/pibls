<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `PalavraVivaAdmin` (contracts/openapi.yaml): o detalhe mais o link original do YouTube, o estado e quem alterou por
 * último.
 *
 * @mixin PalavraVivaPost
 */
final class PalavraVivaAdminResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...(new PalavraVivaDetailResource($this->resource))->toArray($request),
            'youtube_url' => $this->youtube_url,
            'status' => $this->status()->value,
            'updated_at' => $this->updated_at?->utc()->format('Y-m-d\TH:i:s\Z'),
            'updated_by' => $this->updater === null ? null : ['id' => $this->updater->getKey(), 'name' => $this->updater->name],
        ];
    }
}
