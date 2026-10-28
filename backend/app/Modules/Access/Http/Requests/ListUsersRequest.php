<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Requests;

use App\Modules\Access\Actions\ListUsers;
use Illuminate\Foundation\Http\FormRequest;

/** `GET /api/admin/users`: filtros, ordenação e paginação do diretório. */
final class ListUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // a permissão `users.read` é conferida pela rota (BR-076)
    }

    /** A query string traz `true` e `false` como texto; a regra `boolean` do Laravel só entende 1 e 0. */
    protected function prepareForValidation(): void
    {
        $isActive = $this->query('is_active');

        if (is_string($isActive) && in_array(strtolower($isActive), ['true', 'false'], true)) {
            $this->merge(['is_active' => strtolower($isActive) === 'true']);
        }
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'is_active' => ['nullable', 'boolean'],
            'ministry_id' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.ListUsers::MAX_PER_PAGE],
            'sort' => ['nullable', 'string', 'in:name,-name'],
        ];
    }
}
