<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Paginação das listas de Palavra Viva (pública e do painel): `page` e `per_page` (até 100).
 */
final class PageRequest extends FormRequest
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
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
