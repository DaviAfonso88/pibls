<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Requests;

use App\Modules\Leads\Enums\LeadType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** `GET /api/admin/leads/assignees?type=` (BR-009): para qual tipo de contato se procura um responsável. */
final class ListAssigneesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // a permissão de gestão do tipo é conferida pelo controlador (BR-076)
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::enum(LeadType::class)],
        ];
    }

    public function leadType(): LeadType
    {
        return LeadType::from((string) $this->input('type'));
    }
}
