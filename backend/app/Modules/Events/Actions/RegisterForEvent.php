<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Events\RegistrationCreated;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Events\ValueObjects\FormSchema;
use App\Modules\Events\ValueObjects\InvalidRegistrationAnswers;
use App\Modules\Events\ValueObjects\RegistrationAnswers;
use App\Shared\Http\BusinessRuleException;
use App\Shared\ValueObjects\Consent;
use App\Shared\ValueObjects\PersonName;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Inscreve uma pessoa num evento publicado (CAP-19, BR-020 a BR-024, BR-083), com garantia de vaga e de não duplicidade
 * sob concorrência (E-02). Numa única transação:
 *
 *  1. trava a linha do evento (`SELECT … FOR UPDATE`): as inscrições do mesmo evento passam uma de cada vez;
 *  2. confere prazo e início (BR-020) e vagas (BR-021), contando as inscrições já gravadas;
 *  3. valida o que depende do formulário vigente: nome e telefone, se o evento os pede (BR-004, ADR-025), responsável
 *     (BR-023), consentimento de saúde (BR-083) e respostas (BR-024). Tudo é lido sob o bloqueio, então vale o formulário
 *     do instante da inscrição. Campo fixo que o evento não pede é descartado, mesmo que venha no pedido;
 *  4. grava; a constraint única (evento, telefone, nome normalizado) recusa a duplicada (BR-022). Sem o nome ou sem o
 *     telefone (o evento não os pede), ela não compara e a duplicidade não é barrada;
 *  5. emite `RegistrationCreated`, cujo listener enfileira a confirmação.
 *
 * E-mail nunca é enviado aqui: a falha do SMTP não desfaz a inscrição.
 */
final class RegisterForEvent
{
    /**
     * @param  array{
     *     participant_name: string|null,
     *     phone: string|null,
     *     email: string|null,
     *     guardian_name: string|null,
     *     guardian_phone: string|null,
     *     guardian_consent: bool|null,
     *     answers: array<array-key, mixed>,
     *     health_consent: bool|null,
     * }  $data  campos fixos, já validados no formato e normalizados (telefone em E.164, e-mail em minúsculas)
     */
    public function __invoke(string $slug, array $data): EventRegistration
    {
        $consent = Consent::given(true, (string) config('pibls.privacy_policy_version'));

        return DB::transaction(function () use ($slug, $data, $consent): EventRegistration {
            // Rascunho e inexistente são o mesmo 404: não revela que o rascunho existe
            $event = Event::query()->where('slug', $slug)->where('is_published', true)->lockForUpdate()->firstOrFail();

            $this->assertOpen($event);

            $schema = FormSchema::from($event->form_schema);
            $fields = $this->validated($event, $schema, $data);

            $name = $event->asks_participant_name ? PersonName::tryFrom($data['participant_name']) : null;

            try {
                $registration = EventRegistration::query()->create([
                    'event_id' => $event->getKey(),
                    'participant_name' => $name?->value(),
                    'participant_name_normalized' => $name?->normalized(),
                    'phone' => $event->asks_phone ? $data['phone'] : null,
                    'email' => $event->asks_email ? $data['email'] : null,
                    ...$fields,
                    ...$consent->toAttributes(),
                    'health_consent_at' => $schema->hasSensitiveField() ? $consent->at->format('Y-m-d H:i:s') : null,
                ]);
            } catch (UniqueConstraintViolationException) {
                throw new BusinessRuleException('DUPLICATE_REGISTRATION', __('business.BR-022'));
            }

            $registration->setRelation('event', $event);
            event(new RegistrationCreated($registration->getKey()));

            return $registration;
        });
    }

    /** BR-020: o evento já começou ou o prazo venceu. BR-021: as vagas acabaram. */
    private function assertOpen(Event $event): void
    {
        $now = now();

        if ($event->starts_at->lessThanOrEqualTo($now)
            || ($event->registration_deadline !== null && $event->registration_deadline->lessThanOrEqualTo($now))) {
            throw new BusinessRuleException('REGISTRATION_CLOSED', __('business.BR-020'));
        }

        if ($event->max_spots !== null && $event->registrations()->count() >= $event->max_spots) {
            throw new BusinessRuleException('EVENT_FULL', __('business.BR-021'));
        }
    }

    /**
     * Nome e telefone (quando o evento os pede), responsável, consentimento de saúde e respostas, contra o formulário
     * vigente.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed> os campos a gravar além dos fixos
     */
    private function validated(Event $event, FormSchema $schema, array $data): array
    {
        $errors = [];
        $guardian = [];

        if ($event->asks_participant_name && ($data['participant_name'] ?? null) === null) {
            $errors['participant_name'] = [__('business.BR-004.0')];
        }

        if ($event->asks_phone && ($data['phone'] ?? null) === null) {
            $errors['phone'] = [__('business.BR-004.1')];
        }

        if ($event->has_minors) {
            $name = PersonName::tryFrom($data['guardian_name'] ?? null);
            $phone = $data['guardian_phone'] ?? null;

            foreach (['guardian_name' => $name, 'guardian_phone' => $phone, 'guardian_consent' => ($data['guardian_consent'] ?? null) === true ? true : null] as $field => $value) {
                if ($value === null) {
                    $errors[$field] = [__('business.BR-023')];
                }
            }

            if ($errors === []) {
                $guardian = [
                    'guardian_name' => $name?->value(),
                    'guardian_phone' => $phone,
                    'guardian_consent_at' => now()->utc()->format('Y-m-d H:i:s'),
                ];
            }
        }

        if ($schema->hasSensitiveField() && ($data['health_consent'] ?? null) !== true) {
            $errors['health_consent'] = [__('business.BR-083')];
        }

        $answers = [];
        try {
            $answers = RegistrationAnswers::from($schema, $data['answers'])->toArray();
        } catch (InvalidRegistrationAnswers $invalid) {
            foreach ($invalid->errors as $key => $message) {
                $errors["answers.{$key}"] = [$message];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        return [...$guardian, 'answers' => $answers];
    }
}
