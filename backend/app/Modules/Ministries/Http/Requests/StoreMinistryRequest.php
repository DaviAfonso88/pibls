<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/admin/ministries`: um item novo (BR-049 é conferida na Action).
 */
final class StoreMinistryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return MinistryRules::for(partial: false);
    }

    /**
     * Só o que foi enviado, para a ordem e o estado assumirem o padrão quando faltam.
     *
     * @return array<string, mixed>
     */
    public function fields(): array
    {
        return array_filter($this->validated(), fn (mixed $value, string $key) => ! in_array($key, ['display_order', 'is_active'], true) || $value !== null, ARRAY_FILTER_USE_BOTH);
    }
}
