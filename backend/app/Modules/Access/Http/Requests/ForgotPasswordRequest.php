<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** `POST /api/auth/forgot-password`. */
final class ForgotPasswordRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:254'],
        ];
    }
}
