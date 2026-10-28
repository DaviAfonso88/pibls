<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `GET /api/public/bulletins`: `page`, `year` (1985 a 2100) e `month` (1 a 12, que exige o ano).
 */
final class ListPublicBulletinsRequest extends FormRequest
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
            'year' => ['nullable', 'integer', 'min:1985', 'max:2100', 'required_with:month'],
            'month' => ['nullable', 'integer', 'min:1', 'max:12'],
        ];
    }
}
