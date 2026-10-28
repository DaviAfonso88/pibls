<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MinistryGroup>
 */
class MinistryGroupFactory extends Factory
{
    protected $model = MinistryGroup::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'category' => 'MINISTERIO',
            'name' => 'Ministério '.fake()->unique()->words(2, true),
            'description' => '<p>'.fake()->sentence().'</p>',
            'leaders_text' => fake()->name(),
            'schedule_text' => null,
            'neighborhood' => null,
            'private_address' => null,
            'contact_phone' => '+5531'.fake()->numerify('9########'),
            'contact_email' => fake()->unique()->safeEmail(),
            'display_order' => 0,
            'is_active' => true,
        ];
    }

    public function group(): static
    {
        return $this->state(fn () => [
            'category' => 'GRUPO',
            'name' => 'Grupo '.fake()->unique()->words(2, true),
            'schedule_text' => 'Último sábado do mês, 20h',
        ]);
    }

    /** Célula de CL: exige bairro e horário (BR-049) e guarda um endereço residencial que nunca é público (BR-048). */
    public function cell(): static
    {
        return $this->state(fn () => [
            'category' => 'CELULA',
            'name' => 'Célula '.fake()->unique()->words(2, true),
            'schedule_text' => 'Terças, 20h',
            'neighborhood' => fake()->citySuffix().' '.fake()->lastName(),
            'private_address' => fake()->streetAddress(),
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }
}
