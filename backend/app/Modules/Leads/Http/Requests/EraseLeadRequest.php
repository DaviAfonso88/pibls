<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Requests;

use App\Modules\Leads\Actions\EraseLead;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/** `DELETE /api/admin/leads/{id}` (BR-081): o motivo da exclusão definitiva; hoje só o pedido do titular. */
final class EraseLeadRequest extends FormRequest
{
    /**
     * A permissão de gestão do tipo é conferida ANTES de validar o corpo (BR-076): quem não pode ver o contato recebe 404
     * (BR-007) e quem só lê, 403, mesmo que mande um corpo inválido.
     */
    public function authorize(): bool
    {
        Gate::authorize('manage', $this->route('lead'));

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', Rule::in([EraseLead::REASON_DATA_SUBJECT])],
        ];
    }
}
