<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Requests;

use App\Modules\Ministries\Enums\MinistryCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListPublicMinistriesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'category' => ['nullable', 'string', Rule::enum(MinistryCategory::class)],
            // Só faz sentido para CELULA, mas não é erro pedir com outra categoria: simplesmente não casa nada
            'neighborhood' => ['nullable', 'string', 'max:80'],
        ];
    }

    public function category(): ?MinistryCategory
    {
        return MinistryCategory::tryFrom((string) $this->validated('category'));
    }

    public function neighborhood(): ?string
    {
        $value = $this->validated('neighborhood');

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
