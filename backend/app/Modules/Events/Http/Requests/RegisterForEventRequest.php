<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Requests;

use App\Shared\Validation\ConsentGiven;
use App\Shared\Validation\ValidEmail;
use App\Shared\Validation\ValidPersonName;
use App\Shared\Validation\ValidPhone;
use App\Shared\ValueObjects\EmailAddress;
use App\Shared\ValueObjects\PersonName;
use App\Shared\ValueObjects\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

/**
 * `POST /api/public/events/{slug}/register` (contracts/openapi.yaml → RegistrationInput; BR-001, BR-004). Aqui só o
 * que não depende do evento: o formato dos campos fixos. Quem exige o responsável, o consentimento de saúde e as
 * respostas é a Action, contra o formulário vigente lido sob o bloqueio do evento (BR-023, BR-024, BR-083).
 */
final class RegisterForEventRequest extends FormRequest
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
            'participant_name' => ['required', 'string', new ValidPersonName],
            'phone' => ['required', 'string', new ValidPhone],
            'email' => ['nullable', 'string', new ValidEmail],
            'guardian_name' => ['nullable', 'string', new ValidPersonName],
            'guardian_phone' => ['nullable', 'string', new ValidPhone],
            'guardian_consent' => ['nullable', 'boolean'],
            'answers' => ['nullable', 'array', 'max:30'],
            'consent' => ['required', new ConsentGiven],
            'health_consent' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'participant_name.required' => __('business.BR-004.0'),
            'participant_name.string' => __('business.BR-004.0'),
            'phone.required' => __('business.BR-004.1'),
            'phone.string' => __('business.BR-004.1'),
            'email.string' => __('business.BR-004.2'),
            'guardian_name.string' => __('business.BR-023'),
            'guardian_phone.string' => __('business.BR-023'),
            'guardian_consent.boolean' => __('business.BR-023'),
            'answers.array' => __('business.BR-024.6'),
            'consent.required' => __('business.BR-001'),
            'health_consent.boolean' => __('business.BR-083'),
        ];
    }

    /**
     * Os campos fixos normalizados: nome sem espaços sobrando, telefones em E.164, e-mail em minúsculas.
     *
     * @return array{participant_name: string, phone: string, email: string|null, guardian_name: string|null, guardian_phone: string|null, guardian_consent: bool|null, answers: array<array-key, mixed>, health_consent: bool|null}
     */
    public function registration(): array
    {
        $data = $this->validated();

        return [
            'participant_name' => PersonName::from((string) $data['participant_name'])->value(),
            'phone' => PhoneNumber::from((string) $data['phone'])->e164(),
            'email' => EmailAddress::tryFrom($data['email'] ?? null)?->value(),
            'guardian_name' => PersonName::tryFrom($data['guardian_name'] ?? null)?->value(),
            'guardian_phone' => PhoneNumber::tryFrom($data['guardian_phone'] ?? null)?->e164(),
            'guardian_consent' => $data['guardian_consent'] ?? null,
            'answers' => $data['answers'] ?? [],
            'health_consent' => $data['health_consent'] ?? null,
        ];
    }
}
