<?php

declare(strict_types=1);

namespace App\Modules\Events\Models;

use Database\Factories\EventRegistrationFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Inscrição em um evento (R2). `answers` (🔒) guarda o JSON `[{key, label, type, value}]` cifrado.
 * O cancelamento pelo painel é exclusão definitiva e libera a vaga (BR-034).
 *
 * @property int $id
 * @property int $event_id
 * @property string $participant_name
 * @property string $participant_name_normalized
 * @property string $phone
 * @property string|null $email
 * @property string|null $guardian_name
 * @property string|null $guardian_phone
 * @property Carbon|null $guardian_consent_at
 * @property array<int, array<string, mixed>> $answers
 * @property Carbon $consent_at
 * @property string $consent_version
 * @property Carbon|null $health_consent_at
 */
#[UseFactory(EventRegistrationFactory::class)]
#[Table(name: 'event_registrations')]
#[Fillable([
    'event_id', 'participant_name', 'participant_name_normalized', 'phone', 'email', 'guardian_name',
    'guardian_phone', 'guardian_consent_at', 'answers', 'consent_at', 'consent_version', 'health_consent_at',
])]
class EventRegistration extends Model
{
    /** @use HasFactory<EventRegistrationFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'answers' => 'encrypted:array',
            'guardian_consent_at' => 'datetime',
            'consent_at' => 'datetime',
            'health_consent_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Event, $this> */
    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class, 'event_id');
    }
}
