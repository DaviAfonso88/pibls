<?php

declare(strict_types=1);

namespace App\Modules\Content\Models;

use App\Modules\Content\Models\Concerns\HasPublicationWindow;
use Database\Factories\BulletinFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Boletim. Exclusão lógica (ADR-009); `edition_number_active` é uma coluna gerada só para a unicidade (BR-040).
 *
 * @property int $id
 * @property int $edition_number
 * @property Carbon $reference_date
 * @property string $title
 * @property string|null $summary_text
 * @property string $pdf_path
 * @property int $pdf_size_bytes
 * @property Carbon $published_at
 */
#[UseFactory(BulletinFactory::class)]
#[Table(name: 'bulletins')]
#[Fillable([
    'edition_number', 'reference_date', 'title', 'summary_text', 'pdf_path', 'pdf_size_bytes', 'published_at',
    'created_by', 'updated_by',
])]
class Bulletin extends Model
{
    /** @use HasFactory<BulletinFactory> */
    use HasFactory;

    use HasPublicationWindow;
    use SoftDeletes;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'edition_number' => 'integer',
            'reference_date' => 'date',
            'pdf_size_bytes' => 'integer',
            'published_at' => 'datetime',
        ];
    }
}
