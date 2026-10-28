<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `PATCH /api/admin/ministries/{id}`: altera, ordena, ativa ou desativa. Todo campo é opcional.
 */
final class UpdateMinistryRequest extends FormRequest
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
        return MinistryRules::for(partial: true);
    }

    /**
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        return $this->validated();
    }
}
