<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Requests;

use App\Modules\Ministries\Enums\MinistryCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `GET /api/admin/ministries`: filtros `category`, `is_active` e `q` (parte do nome).
 */
final class ListAdminMinistriesRequest extends FormRequest
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
        return [
            'category' => ['nullable', 'string', Rule::enum(MinistryCategory::class)],
            'is_active' => ['nullable', 'string', Rule::in(['true', 'false', '1', '0'])],
            'q' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function category(): ?MinistryCategory
    {
        return MinistryCategory::tryFrom((string) $this->input('category'));
    }

    public function isActive(): ?bool
    {
        return $this->filled('is_active') ? filter_var($this->input('is_active'), FILTER_VALIDATE_BOOLEAN) : null;
    }
}
