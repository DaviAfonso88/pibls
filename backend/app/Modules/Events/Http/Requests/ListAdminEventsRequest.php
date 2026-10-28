<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Modules\Events\Enums\EventState;
use App\Modules\Events\Models\Event;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * `GET /api/admin/events`: paginação, filtro por estado e por ministério, e ordem por início. Quem pode ver a lista é da
 * `EventPolicy::viewAny`; o recorte por ministério de quem só tem `.own` é da Action.
 */
final class ListAdminEventsRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('viewAny', Event::class);

        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1', 'max:100000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'state' => ['nullable', Rule::enum(EventState::class)],
            'ministry_id' => ['nullable', 'integer', 'min:1'],
            'sort' => ['nullable', Rule::in(['-starts_at', 'starts_at'])],
        ];
    }

    public function state(): ?EventState
    {
        return $this->filled('state') ? EventState::from((string) $this->input('state')) : null;
    }

    public function ministryId(): ?int
    {
        return $this->filled('ministry_id') ? $this->integer('ministry_id') : null;
    }

    public function sort(): string
    {
        return $this->input('sort') === 'starts_at' ? 'starts_at' : '-starts_at';
    }
}
