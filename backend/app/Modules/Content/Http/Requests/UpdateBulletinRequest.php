<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use App\Modules\Content\Support\BulletinLink;
use App\Shared\Support\PublicationInstant;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `PATCH /api/admin/bulletins/{id}`: os metadados e o link externo; todos opcionais. O PDF troca por `POST …/pdf`.
 * Mandar `external_url` faz o boletim passar a usar o link (BR-084); o caminho de volta é enviar um PDF.
 */
final class UpdateBulletinRequest extends FormRequest
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
            'edition_number' => ['sometimes', 'required', 'integer', 'min:1', 'max:999999'],
            'reference_date' => ['sometimes', 'required', 'date_format:Y-m-d'],
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:150'],
            'summary_text' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'published_at' => ['sometimes', 'required', 'date'],
            'external_url' => ['sometimes', 'required', 'string', BulletinLink::rule()],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return ['external_url.required' => __('business.BR-084.0')];
    }

    /**
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        $changes = [];

        foreach (['edition_number', 'reference_date', 'title'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = $key === 'edition_number' ? $this->integer($key) : trim((string) $this->input($key));
            }
        }

        if ($this->exists('summary_text')) {
            $changes['summary_text'] = $this->filled('summary_text') ? (string) $this->input('summary_text') : null;
        }

        if ($this->exists('published_at')) {
            $changes['published_at'] = PublicationInstant::parse((string) $this->input('published_at'));
        }

        if ($this->exists('external_url')) {
            $changes['external_url'] = BulletinLink::tryParse((string) $this->input('external_url'))?->url;
        }

        return $changes;
    }
}
