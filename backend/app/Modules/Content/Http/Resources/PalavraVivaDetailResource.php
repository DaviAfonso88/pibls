<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `PalavraVivaDetail` (contracts/openapi.yaml): o resumo mais o corpo, que é HTML já sanitizado (`SanitizedHtml`).
 *
 * @mixin PalavraVivaPost
 */
final class PalavraVivaDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...(new PalavraVivaSummaryResource($this->resource))->toArray($request),
            'body' => $this->body,
        ];
    }
}
