<?php

declare(strict_types=1);

namespace App\Modules\Leads\Models;

use App\Modules\Access\Models\User;
use App\Modules\Ministries\Models\MinistryGroup;
use Database\Factories\LeadFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Contato recebido pelos formulários públicos. `message` (🔒) é cifrada e nunca pesquisável (ADR-016).
 * Exclusão definitiva: a pedido do titular (BR-081) ou pelo expurgo (BR-080).
 *
 * @property int $id
 * @property string $type
 * @property string $status
 * @property string|null $name
 * @property string|null $phone
 * @property string|null $email
 * @property string|null $neighborhood
 * @property bool|null $wants_visit
 * @property bool|null $wants_cell_group
 * @property int|null $group_id
 * @property bool|null $from_other_baptist_church
 * @property int|null $ministry_id
 * @property string|null $message
 * @property int|null $assigned_to
 * @property Carbon $consent_at
 * @property string $consent_version
 * @property Carbon $status_changed_at
 * @property Carbon|null $created_at
 */
#[UseFactory(LeadFactory::class)]
#[Table(name: 'leads_messages')]
#[Fillable([
    'type', 'status', 'name', 'phone', 'email', 'neighborhood', 'wants_visit', 'wants_cell_group', 'group_id',
    'from_other_baptist_church', 'ministry_id', 'message', 'assigned_to', 'consent_at', 'consent_version',
    'status_changed_at',
])]
class Lead extends Model
{
    /** @use HasFactory<LeadFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'message' => 'encrypted',
            'wants_visit' => 'boolean',
            'wants_cell_group' => 'boolean',
            'from_other_baptist_church' => 'boolean',
            'consent_at' => 'datetime',
            'status_changed_at' => 'datetime',
        ];
    }

    /** Dias a partir dos quais um contato `NOVO` aparece em destaque (BR-010). */
    public const STALLED_AFTER_DAYS = 3;

    /**
     * "Aguardando atendimento há N dias" (BR-010): só para contato `NOVO` há mais de 3 dias; caso contrário, nulo.
     */
    public function waitingDays(?Carbon $now = null): ?int
    {
        $now ??= Carbon::now();

        if ($this->status !== 'NOVO' || ! $this->created_at instanceof Carbon) {
            return null;
        }

        if ($this->created_at->greaterThanOrEqualTo($now->copy()->subDays(self::STALLED_AFTER_DAYS))) {
            return null;
        }

        return (int) $this->created_at->diffInDays($now, true);
    }

    /** @return BelongsTo<MinistryGroup, $this> */
    public function group(): BelongsTo
    {
        return $this->belongsTo(MinistryGroup::class, 'group_id');
    }

    /** @return BelongsTo<MinistryGroup, $this> */
    public function ministry(): BelongsTo
    {
        return $this->belongsTo(MinistryGroup::class, 'ministry_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    /** @return HasMany<LeadActivity, $this> */
    public function activities(): HasMany
    {
        return $this->hasMany(LeadActivity::class, 'lead_id');
    }
}
