<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use App\Shared\Support\PublicationInstant;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `PATCH /api/admin/palavra-viva/{id}`: os mesmos campos do cadastro, todos opcionais.
 */
final class UpdatePalavraVivaRequest extends FormRequest
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
            'title' => ['sometimes', 'required', 'string', 'min:3', 'max:150'],
            'slug' => ['sometimes', 'required', 'string', 'max:160', 'regex:'.StorePalavraVivaRequest::SLUG_PATTERN],
            'body' => ['sometimes', 'required', 'string', 'max:50000'],
            'author_display' => ['sometimes', 'nullable', 'string', 'max:120'],
            'youtube_url' => ['sometimes', 'nullable', 'string', 'max:255'],
            'published_at' => ['sometimes', 'required', 'date'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['slug.regex' => 'Use só letras minúsculas, números e hífens, sem acento.'];
    }

    /**
     * @return array<string, mixed>
     */
    public function changes(): array
    {
        $changes = [];

        foreach (['title', 'slug', 'body'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = $key === 'body' ? (string) $this->input($key) : trim((string) $this->input($key));
            }
        }

        foreach (['author_display', 'youtube_url'] as $key) {
            if ($this->exists($key)) {
                $changes[$key] = $this->filled($key) ? trim((string) $this->input($key)) : null;
            }
        }

        if ($this->exists('published_at')) {
            $changes['published_at'] = PublicationInstant::parse((string) $this->input('published_at'));
        }

        return $changes;
    }
}
