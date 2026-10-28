<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use App\Modules\Content\Enums\PublicationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `GET /api/admin/bulletins`: `year`, `status` (AGENDADO ou PUBLICADO), `sort` e a paginação.
 */
final class ListAdminBulletinsRequest extends FormRequest
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
            'year' => ['nullable', 'integer', 'min:1985', 'max:2100'],
            'status' => ['nullable', 'string', Rule::enum(PublicationStatus::class)],
            'sort' => ['nullable', 'string', Rule::in(['-reference_date', '-edition_number'])],
        ];
    }

    public function publicationStatus(): ?PublicationStatus
    {
        return PublicationStatus::tryFrom((string) $this->input('status'));
    }
}
