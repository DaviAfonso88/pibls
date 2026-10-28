<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<EventRegistration>
 */
class EventRegistrationFactory extends Factory
{
    protected $model = EventRegistration::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->name();

        return [
            'event_id' => Event::factory(),
            'participant_name' => $name,
            // Minúsculas, sem acentos, espaços colapsados (BR-022)
            'participant_name_normalized' => Str::of($name)->ascii()->lower()->squish()->toString(),
            'phone' => '+5531'.fake()->numerify('9########'),
            'email' => fake()->safeEmail(),
            'answers' => [],
            'consent_at' => now(),
            'consent_version' => '1.0',
        ];
    }
}
