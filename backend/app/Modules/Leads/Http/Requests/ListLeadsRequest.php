<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Requests;

use App\Modules\Access\Models\User;
use App\Modules\Leads\Actions\ListLeads;
use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Enums\LeadType;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * `GET /api/admin/leads` (CAP-10 e CAP-11): a caixa (`inbox`, obrigatória), os filtros e a ordenação. `sort` só aceita a
 * lista fechada (allowlist), nunca um nome de coluna vindo da URL.
 */
final class ListLeadsRequest extends FormRequest
{
    /** Valor de `status` que junta os contatos ainda em aberto. */
    public const OPEN = 'ABERTOS';

    public function authorize(): bool
    {
        return true; // a permissão da caixa é conferida pelo controlador (BR-076)
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'inbox' => ['required', 'string', Rule::in(['geral', 'oracao'])],
            // O pedido de oração tem caixa própria: o tipo só filtra a caixa geral
            'type' => ['nullable', 'string', 'prohibited_if:inbox,oracao', Rule::in(array_map(fn (LeadType $type) => $type->value, LeadType::general()))],
            // `ABERTOS` = NOVO e EM_ATENDIMENTO (o padrão da tela); não é um status, é um atalho de filtro
            'status' => ['nullable', 'string', Rule::in([...array_map(fn (LeadStatus $status) => $status->value, LeadStatus::cases()), self::OPEN])],
            // Um id, `me` (quem consulta) ou `none` (sem responsável)
            'assigned_to' => ['nullable', function (string $attribute, mixed $value, Closure $fail): void {
                if (! in_array($value, ['me', 'none'], true) && ! (is_numeric($value) && (int) $value >= 1 && (string) (int) $value === (string) $value)) {
                    $fail(__('validation.in', ['attribute' => $attribute]));
                }
            }],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'min:2', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.ListLeads::MAX_PER_PAGE],
            'sort' => ['nullable', 'string', Rule::in(['created_at', '-created_at'])],
        ];
    }

    public function prayerInbox(): bool
    {
        return $this->input('inbox') === 'oracao';
    }

    public function leadType(): ?LeadType
    {
        return LeadType::tryFrom((string) $this->input('type'));
    }

    public function leadStatus(): ?LeadStatus
    {
        return LeadStatus::tryFrom((string) $this->input('status'));
    }

    public function onlyOpen(): bool
    {
        return $this->input('status') === self::OPEN;
    }

    public function withoutAssignee(): bool
    {
        return $this->input('assigned_to') === 'none';
    }

    /** `me` vira o id de quem consulta. */
    public function assignedTo(User $viewer): ?int
    {
        $value = $this->input('assigned_to');

        return match (true) {
            $value === 'me' => (int) $viewer->getKey(),
            is_numeric($value) => (int) $value,
            default => null,
        };
    }
}
