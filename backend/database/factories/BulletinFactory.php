<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Content\Models\Bulletin;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Bulletin>
 */
class BulletinFactory extends Factory
{
    protected $model = Bulletin::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $date = fake()->dateTimeBetween('-1 year', 'now');

        return [
            'edition_number' => fake()->unique()->numberBetween(1, 100000),
            'reference_date' => $date->format('Y-m-d'),
            'title' => 'Boletim '.fake()->words(3, true),
            'summary_text' => fake()->sentence(),
            'pdf_path' => 'boletins/'.$date->format('Y').'/'.bin2hex(random_bytes(16)).'.pdf',
            'pdf_size_bytes' => fake()->numberBetween(50_000, 2_000_000),
            'published_at' => $date,
        ];
    }

    /** Agendado: `published_at` no futuro, invisível para o público (BR-042). */
    public function scheduled(): static
    {
        return $this->state(fn () => ['published_at' => now()->addDays(3)]);
    }

    public function trashed(): static
    {
        return $this->state(fn () => ['deleted_at' => now()]);
    }
}
