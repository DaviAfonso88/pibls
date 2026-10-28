<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/auth/login`. Só confere o formato do envelope: se o e-mail existe e se a senha confere é segredo da Action
 * (BR-070). Por isso não há regra de formato de e-mail aqui, para o 422 não mudar conforme o texto digitado.
 */
final class LoginRequest extends FormRequest
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
            'email' => ['required', 'string', 'max:254'],
            'password' => ['required', 'string', 'max:200'],
        ];
    }
}
