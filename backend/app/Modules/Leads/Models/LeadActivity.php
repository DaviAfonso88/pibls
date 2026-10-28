<?php

declare(strict_types=1);

namespace App\Modules\Leads\Models;

use App\Modules\Access\Models\User;
use Database\Factories\LeadActivityFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Registro de atendimento de um contato. Só inclusão; apagado em cascata com o contato.
 * `note` (🔒) é cifrada.
 *
 * @property int $id
 * @property int $lead_id
 * @property int $actor_user_id
 * @property string|null $from_status
 * @property string|null $to_status
 * @property int|null $assigned_to
 * @property string|null $note
 */
#[UseFactory(LeadActivityFactory::class)]
#[Table(name: 'lead_activities')]
#[Fillable(['lead_id', 'actor_user_id', 'from_status', 'to_status', 'assigned_to', 'note'])]
class LeadActivity extends Model
{
    /** @use HasFactory<LeadActivityFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'note' => 'encrypted',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Lead, $this> */
    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
