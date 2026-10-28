<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PalavraVivaPost>
 */
class PalavraVivaPostFactory extends Factory
{
    protected $model = PalavraVivaPost::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = Str::title(fake()->words(4, true));
        $text = fake()->paragraph();

        return [
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 1_000_000),
            'body' => '<p>'.$text.'</p>',
            'excerpt' => Str::limit($text, 300, ''),
            'author_display' => fake()->name(),
            'youtube_url' => null,
            'youtube_video_id' => null,
            'published_at' => fake()->dateTimeBetween('-6 months', 'now'),
        ];
    }

    public function scheduled(): static
    {
        return $this->state(fn () => ['published_at' => now()->addDays(3)]);
    }

    public function trashed(): static
    {
        return $this->state(fn () => ['deleted_at' => now()]);
    }
}
