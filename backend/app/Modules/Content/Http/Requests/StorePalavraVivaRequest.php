<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use App\Shared\Support\PublicationInstant;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/admin/palavra-viva`: título, endereço (slug), corpo em HTML (sanitizado depois, BR-046), autor, link do
 * YouTube (BR-044, conferido na Action) e `published_at`.
 */
final class StorePalavraVivaRequest extends FormRequest
{
    public const SLUG_PATTERN = '/^[a-z0-9]+(-[a-z0-9]+)*$/';

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
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'slug' => ['required', 'string', 'max:160', 'regex:'.self::SLUG_PATTERN],
            'body' => ['required', 'string', 'max:50000'],
            'author_display' => ['nullable', 'string', 'max:120'],
            'youtube_url' => ['nullable', 'string', 'max:255'],
            'published_at' => ['nullable', 'date'],
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
     * @return array{title: string, slug: string, body: string, author_display: string|null, youtube_url: string|null}
     */
    public function fields(): array
    {
        return [
            'title' => trim((string) $this->input('title')),
            'slug' => (string) $this->input('slug'),
            'body' => (string) $this->input('body'),
            'author_display' => $this->filled('author_display') ? trim((string) $this->input('author_display')) : null,
            'youtube_url' => $this->filled('youtube_url') ? trim((string) $this->input('youtube_url')) : null,
        ];
    }

    public function publishedAt(): ?CarbonImmutable
    {
        return PublicationInstant::parse($this->filled('published_at') ? (string) $this->input('published_at') : null);
    }
}
