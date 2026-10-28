<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/admin/bulletins/{id}/pdf` (multipart): o PDF novo. Tipo e tamanho são do `UploadStore` (BR-041).
 */
final class ReplaceBulletinPdfRequest extends FormRequest
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
        return ['pdf' => ['required', 'file']];
    }
}
