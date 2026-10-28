<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Events\Models\Event;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Event>
 */
class EventFactory extends Factory
{
    protected $model = Event::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = Str::title(fake()->words(3, true));
        $startsAt = fake()->dateTimeBetween('+1 week', '+3 months');
        $text = fake()->paragraph();

        return [
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 1_000_000),
            'ministry_id' => MinistryGroup::factory(),
            'description' => '<p>'.$text.'</p>',
            'excerpt' => Str::limit($text, 300, ''),
            'starts_at' => $startsAt,
            'ends_at' => null,
            'location' => fake()->streetAddress(),
            'banner_path' => null,
            'max_spots' => null,
            'registration_deadline' => null,
            'has_minors' => false,
            'is_published' => false,
            'form_schema' => [],
        ];
    }

    public function published(): static
    {
        return $this->state(fn () => ['is_published' => true]);
    }

    public function withMinors(): static
    {
        return $this->state(fn () => ['has_minors' => true]);
    }
}
