<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Models\Lead;
use App\Modules\Leads\Models\LeadActivity;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LeadActivity>
 */
class LeadActivityFactory extends Factory
{
    protected $model = LeadActivity::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'lead_id' => Lead::factory(),
            'actor_user_id' => User::factory(),
            'from_status' => null,
            'to_status' => null,
            'assigned_to' => null,
            'note' => fake()->sentence(),
        ];
    }
}
