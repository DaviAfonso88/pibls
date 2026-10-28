<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `PalavraVivaSummary` (contracts/openapi.yaml): sem o corpo, só o que a lista e os destaques mostram.
 *
 * @mixin PalavraVivaPost
 */
final class PalavraVivaSummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'author_display' => $this->author_display,
            'youtube_video_id' => $this->youtube_video_id,
            'published_at' => $this->published_at->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
