<?php

declare(strict_types=1);

namespace App\Modules\Leads\Http\Requests;

use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Rules\ActiveGroup;
use App\Modules\Leads\Rules\ActiveMinistry;
use App\Shared\Validation\ConsentGiven;
use App\Shared\Validation\ValidEmail;
use App\Shared\Validation\ValidPersonName;
use App\Shared\Validation\ValidPhone;
use App\Shared\ValueObjects\EmailAddress;
use App\Shared\ValueObjects\PersonName;
use App\Shared\ValueObjects\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validação do `POST /api/public/leads` (contracts/openapi.yaml → LeadInput; data-model.md → Campos obrigatórios por
 * tipo; BR-001, BR-004, BR-005, BR-006). Só os campos do tipo têm regra, então só eles voltam em `validated()`: o que
 * o tipo não usa é ignorado, nunca gravado.
 */
final class SubmitLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function leadType(): LeadType
    {
        return LeadType::from((string) $this->input('type'));
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $rules = [
            'type' => ['required', 'string', Rule::enum(LeadType::class)],
            'consent' => ['required', new ConsentGiven],
        ];

        $type = LeadType::tryFrom((string) $this->input('type'));
        if ($type === null) {
            return $rules; // o tipo já falhou; as demais regras dependem dele
        }

        $contactOrEmail = in_array($type, [LeadType::Contato, LeadType::Ministerio], true);

        $rules['name'] = $type === LeadType::Oracao
            ? ['nullable', 'string', new ValidPersonName]
            : ['required', 'string', new ValidPersonName];

        $rules['phone'] = match (true) {
            $contactOrEmail => ['nullable', 'required_without:email', 'string', new ValidPhone],
            in_array($type, [LeadType::Visitante, LeadType::Membro], true) => ['required', 'string', new ValidPhone],
            default => ['nullable', 'string', new ValidPhone],
        };

        $rules['email'] = match (true) {
            $contactOrEmail => ['nullable', 'required_without:phone', 'string', new ValidEmail],
            $type === LeadType::Visitante => [],
            default => ['nullable', 'string', new ValidEmail],
        };
        if ($rules['email'] === []) {
            unset($rules['email']);
        }

        $messageMax = $type->maxMessageLength();
        $rules['message'] = $type->requiresMessage()
            ? ['required', 'string', 'min:5', "max:{$messageMax}"]
            : ['nullable', 'string', "max:{$messageMax}"];

        if ($type === LeadType::Visitante) {
            $rules['neighborhood'] = ['required', 'string', 'min:2', 'max:80'];
            $rules['wants_visit'] = ['required', 'boolean'];
            $rules['wants_cell_group'] = ['required', 'boolean'];
            $rules['group_id'] = ['nullable', 'integer', new ActiveGroup];
        }

        if ($type === LeadType::Membro) {
            $rules['from_other_baptist_church'] = ['required', 'boolean'];
        }

        if ($type === LeadType::Ministerio) {
            $rules['ministry_id'] = ['required', 'integer', new ActiveMinistry];
        }

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'consent.required' => __('business.BR-001'),
            'name.required' => __('business.BR-004.0'),
            'name.string' => __('business.BR-004.0'),
            'phone.required' => __('business.BR-004.1'),
            'phone.string' => __('business.BR-004.1'),
            'phone.required_without' => __('business.BR-005'),
            'email.required_without' => __('business.BR-005'),
            'email.string' => __('business.BR-004.2'),
            'message.required' => __('business.BR-004.3'),
            'message.min' => __('business.BR-004.3'),
            'message.string' => __('business.BR-004.3'),
            'neighborhood.required' => __('business.BR-049.1'),
            'wants_visit.required' => __('business.BR-024.0'),
            'wants_visit.boolean' => __('business.BR-024.1'),
            'wants_cell_group.required' => __('business.BR-024.0'),
            'wants_cell_group.boolean' => __('business.BR-024.1'),
            'from_other_baptist_church.required' => __('business.BR-024.0'),
            'from_other_baptist_church.boolean' => __('business.BR-024.1'),
            'ministry_id.required' => __('business.BR-006.0'),
            'ministry_id.integer' => __('business.BR-006.0'),
            'group_id.integer' => __('business.BR-006.1'),
        ];
    }

    /**
     * Os dados do contato já normalizados (E.164, e-mail em minúsculas, nome sem espaços sobrando), só os campos do tipo.
     *
     * @return array<string, mixed>
     */
    public function lead(): array
    {
        /** @var array<string, mixed> $data */
        $data = $this->validated();
        unset($data['consent']);

        if (isset($data['name'])) {
            $data['name'] = PersonName::tryFrom((string) $data['name'])?->value();
        }
        if (isset($data['phone'])) {
            $data['phone'] = PhoneNumber::tryFrom((string) $data['phone'])?->e164();
        }
        if (isset($data['email'])) {
            $data['email'] = EmailAddress::tryFrom((string) $data['email'])?->value();
        }

        return $data;
    }
}
