<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `GET /api/public/events`: `page` e `include_past` (traz também os eventos que já aconteceram).
 */
final class ListPublicEventsRequest extends FormRequest
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
            'include_past' => ['nullable', 'boolean'],
        ];
    }
}
