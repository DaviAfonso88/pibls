<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/admin/settings/pix` (multipart). Aqui só a forma dos campos: a senha, os destinatários do alerta, o CNPJ, o
 * Copia e Cola e o tipo do QR são conferidos na Action, na ordem da arquitetura (a senha vem primeiro, BR-060), para um
 * pedido com senha errada não dizer nada sobre os outros campos.
 */
final class UpdatePixSettingsRequest extends FormRequest
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
            'current_password' => ['required', 'string', 'max:200'],
            'pix_key' => ['required', 'string', 'max:32'],
            'beneficiary_name' => ['required', 'string', 'min:1', 'max:120'],
            'copy_paste_code' => ['nullable', 'string', 'max:512'],
            'qr_image' => ['nullable', 'file'],
        ];
    }
}
