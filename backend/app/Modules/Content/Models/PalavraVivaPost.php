<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use App\Modules\Content\Models\Concerns\HasPublicationWindow;
use Database\Factories\PalavraVivaPostFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Mensagem Palavra Viva. `body` é HTML sanitizado (SanitizedHtml); `slug_active` é uma coluna gerada (BR-032).
 *
 * @property int $id
 * @property string $title
 * @property string $slug
 * @property string $body
 * @property string $excerpt
 * @property string|null $author_display
 * @property string|null $youtube_url
 * @property string|null $youtube_video_id
 * @property Carbon $published_at
 */
#[UseFactory(PalavraVivaPostFactory::class)]
#[Table(name: 'palavra_viva_posts')]
#[Fillable([
    'title', 'slug', 'body', 'excerpt', 'author_display', 'youtube_url', 'youtube_video_id', 'published_at',
    'created_by', 'updated_by',
])]
class PalavraVivaPost extends Model
{
    /** @use HasFactory<PalavraVivaPostFactory> */
    use HasFactory;

    use HasPublicationWindow;
    use SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }
}
