<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use App\Modules\Content\Models\Bulletin;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `BulletinPublic` (contracts/openapi.yaml). O PDF é servido direto pelo Apache de `/uploads/`. Vem um de cada vez:
 * ou `pdf_url` e `pdf_size_bytes`, ou `external_url` (BR-084).
 *
 * @mixin Bulletin
 */
final class BulletinPublicResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'edition_number' => $this->edition_number,
            'reference_date' => $this->reference_date->format('Y-m-d'),
            'title' => $this->title,
            'summary_text' => $this->summary_text,
            'pdf_url' => $this->pdf_path === null ? null : '/uploads/'.ltrim($this->pdf_path, '/'),
            'pdf_size_bytes' => $this->pdf_size_bytes,
            'external_url' => $this->external_url,
        ];
    }
}
