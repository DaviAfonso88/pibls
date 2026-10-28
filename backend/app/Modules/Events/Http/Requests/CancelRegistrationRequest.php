<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Actions\CancelRegistration;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * `DELETE /api/admin/events/{id}/registrations/{registrationId}` (BR-034, BR-081): o motivo da exclusão definitiva. A
 * permissão de escrita do evento é conferida ANTES de validar o corpo (BR-076): evento de outro ministério, para quem só
 * tem `.own`, é 404 e quem só lê as inscrições recebe 403, mesmo com um corpo inválido.
 */
final class CancelRegistrationRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('delete', $this->route('registration'));

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in([CancelRegistration::REASON_CANCELLED, CancelRegistration::REASON_DATA_SUBJECT])],
        ];
    }
}
