<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Access\Models\User;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    /**
     * A senha é gerada uma vez por processo: o bcrypt é lento de propósito.
     */
    protected static ?string $password = null;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('password'),
            'ministry_id' => null,
            'is_active' => true,
            'remember_token' => Str::random(10),
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function forMinistry(MinistryGroup|int|null $ministry = null): static
    {
        return $this->state(fn () => [
            'ministry_id' => $ministry instanceof MinistryGroup
                ? $ministry->getKey()
                : ($ministry ?? MinistryGroup::factory()),
        ]);
    }
}
