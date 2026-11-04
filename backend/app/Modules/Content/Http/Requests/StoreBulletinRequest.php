<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use App\Modules\Content\Support\BulletinLink;
use App\Shared\Support\PublicationInstant;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/admin/bulletins`: metadados e o PDF (multipart) ou o link externo (BR-084). O tipo e o tamanho do PDF são
 * conferidos pelo `UploadStore` (422 para tipo errado, 413 para mais de 10 MB, BR-041), e não aqui.
 */
final class StoreBulletinRequest extends FormRequest
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
            'edition_number' => ['required', 'integer', 'min:1', 'max:999999'],
            'reference_date' => ['required', 'date_format:Y-m-d'],
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'summary_text' => ['nullable', 'string', 'max:5000'],
            'published_at' => ['nullable', 'date'],
            'pdf' => ['required_without:external_url', 'file'],
            'external_url' => ['nullable', 'string', 'prohibits:pdf', BulletinLink::rule()],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return [
            'pdf.required_without' => __('business.BR-084.1'),
            'external_url.prohibits' => __('business.BR-084.2'),
        ];
    }

    /**
     * @return array{edition_number: int, reference_date: string, title: string, summary_text: string|null, external_url: string|null}
     */
    public function fields(): array
    {
        return [
            'edition_number' => $this->integer('edition_number'),
            'reference_date' => (string) $this->input('reference_date'),
            'title' => trim((string) $this->input('title')),
            'summary_text' => $this->filled('summary_text') ? (string) $this->input('summary_text') : null,
            'external_url' => $this->filled('external_url') ? BulletinLink::tryParse((string) $this->input('external_url'))?->url : null,
        ];
    }

    public function publishedAt(): ?CarbonImmutable
    {
        return PublicationInstant::parse($this->filled('published_at') ? (string) $this->input('published_at') : null);
    }
}
