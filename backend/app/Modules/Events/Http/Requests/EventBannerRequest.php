<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * `POST /api/admin/events/{id}/banner` (multipart): a imagem do banner. Tipo e tamanho são do `UploadStore` (BR-045);
 * evento de outro ministério, para quem só tem `.own`, é 404 (BR-030).
 */
final class EventBannerRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('manage', $this->route('event'));

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return ['banner' => ['required', 'file']];
    }
}
