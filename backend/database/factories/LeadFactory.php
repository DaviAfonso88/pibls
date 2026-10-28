<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Leads\Models\Lead;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Cada estado produz um contato válido para o tipo, como os formulários públicos (CAP-05).
 *
 * @extends Factory<Lead>
 */
class LeadFactory extends Factory
{
    protected $model = Lead::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $at = now();

        return [
            'type' => 'CONTATO',
            'status' => 'NOVO',
            'name' => fake()->name(),
            'phone' => '+5531'.fake()->numerify('9########'),
            'email' => fake()->safeEmail(),
            'message' => fake()->sentence(8),
            'consent_at' => $at,
            'consent_version' => '1.0',
            'status_changed_at' => $at,
        ];
    }

    public function visitante(): static
    {
        return $this->state(fn () => [
            'type' => 'VISITANTE',
            'neighborhood' => fake()->citySuffix().' '.fake()->lastName(),
            'wants_visit' => fake()->boolean(),
            'wants_cell_group' => fake()->boolean(),
            'email' => null,
            'message' => null,
        ]);
    }

    public function membro(): static
    {
        return $this->state(fn () => [
            'type' => 'MEMBRO',
            'from_other_baptist_church' => fake()->boolean(),
            'email' => null,
            'message' => null,
        ]);
    }

    public function oracao(): static
    {
        return $this->state(fn () => [
            'type' => 'ORACAO',
            'name' => null,
            'phone' => null,
            'email' => null,
            'message' => fake()->paragraph(),
        ]);
    }

    public function ministerio(MinistryGroup|int|null $ministry = null): static
    {
        return $this->state(fn () => [
            'type' => 'MINISTERIO',
            'ministry_id' => $ministry instanceof MinistryGroup
                ? $ministry->getKey()
                : ($ministry ?? MinistryGroup::factory()),
        ]);
    }

    public function waitingDays(int $days): static
    {
        return $this->state(fn () => [
            'created_at' => now()->subDays($days),
            'status_changed_at' => now()->subDays($days),
        ]);
    }
}
