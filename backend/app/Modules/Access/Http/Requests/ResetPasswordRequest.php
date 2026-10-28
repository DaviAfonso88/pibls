<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Requests;

use App\Modules\Access\Rules\StrongPassword;
use Illuminate\Foundation\Http\FormRequest;

/** `POST /api/auth/reset-password`: o token e o e-mail do link e a nova senha duas vezes (BR-072, BR-073). */
final class ResetPasswordRequest extends FormRequest
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
            'email' => ['required', 'string', 'email', 'max:254'],
            'token' => ['required', 'string', 'max:200'],
            'password' => ['required', 'string', 'confirmed', app(StrongPassword::class)],
        ];
    }
}
