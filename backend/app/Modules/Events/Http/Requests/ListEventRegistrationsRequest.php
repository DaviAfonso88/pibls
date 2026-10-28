<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Actions\ListEventRegistrations;
use App\Modules\Events\Models\EventRegistration;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * `GET /api/admin/events/{id}/registrations`: paginação (até 500 linhas, para alimentar o PDF) e busca `q` por nome ou
 * telefone. Quem pode ver as inscrições deste evento é da `EventRegistrationPolicy::viewAny`, conferida antes de validar.
 */
final class ListEventRegistrationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', [EventRegistration::class, $this->route('event')]);

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.ListEventRegistrations::MAX_PER_PAGE],
            'q' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function search(): ?string
    {
        return $this->filled('q') ? (string) $this->input('q') : null;
    }
}
