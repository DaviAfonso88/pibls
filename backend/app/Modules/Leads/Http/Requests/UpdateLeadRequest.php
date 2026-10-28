<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Requests;

use App\Modules\Leads\Actions\AddLeadNote;
use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Support\LeadChanges;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * `PATCH /api/admin/leads/{id}` (CAP-10): status, responsável e anotação, todos opcionais (pelo menos um, conferido na
 * Action). A anotação aceita até 1.000 caracteres (BR-013).
 */
final class UpdateLeadRequest extends FormRequest
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
            'status' => ['nullable', 'string', Rule::enum(LeadStatus::class)],
            'assigned_to' => ['nullable', 'integer', 'min:1'],
            'note' => ['nullable', 'string', 'max:'.AddLeadNote::MAX_LENGTH],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['note.max' => __('business.BR-013')];
    }

    public function changes(): LeadChanges
    {
        return new LeadChanges(
            status: LeadStatus::tryFrom((string) $this->input('status')),
            assigneeGiven: $this->exists('assigned_to'),
            assigneeId: $this->filled('assigned_to') ? $this->integer('assigned_to') : null,
            note: $this->input('note') === null ? null : (string) $this->input('note'),
        );
    }
}
