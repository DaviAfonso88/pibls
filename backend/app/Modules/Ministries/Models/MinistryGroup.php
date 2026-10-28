<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Models;

use Database\Factories\MinistryGroupFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Ministério, grupo ou Célula de CL. `private_address` (🔒) e `contact_email` nunca saem pela API pública
 * nem pelos snapshots (BR-048, BR-050): por isso ficam ocultos na serialização padrão.
 *
 * @property int $id
 * @property string $category
 * @property string $name
 * @property string|null $description
 * @property string|null $leaders_text
 * @property string|null $schedule_text
 * @property string|null $neighborhood
 * @property string|null $private_address
 * @property string|null $contact_phone
 * @property string|null $contact_email
 * @property int $display_order
 * @property bool $is_active
 */
#[UseFactory(MinistryGroupFactory::class)]
#[Table(name: 'ministries_groups')]
#[Fillable([
    'category', 'name', 'description', 'leaders_text', 'schedule_text', 'neighborhood', 'private_address',
    'contact_phone', 'contact_email', 'display_order', 'is_active', 'created_by', 'updated_by',
])]
#[Hidden(['private_address', 'contact_email'])]
class MinistryGroup extends Model
{
    /** @use HasFactory<MinistryGroupFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'private_address' => 'encrypted',
            'display_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
