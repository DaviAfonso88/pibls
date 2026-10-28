<?php

declare(strict_types=1);

namespace App\Modules\Events\Mail;

use App\Modules\Events\Models\EventRegistration;
use App\Modules\Platform\Mail\BaseMail;

/**
 * Confirmação da inscrição, para o e-mail que a pessoa informou (CAP-19): o evento, o dia e o local. NUNCA leva as
 * respostas do formulário, que podem ter dado de saúde. Se a inscrição for cancelada no painel antes do envio, o job
 * é descartado: quem foi cancelado não recebe a confirmação.
 */
final class RegistrationConfirmationMail extends BaseMail
{
    /** Inscrição excluída (BR-034) antes do envio: o job some em vez de falhar. */
    public bool $deleteWhenMissingModels = true;

    public function __construct(private readonly EventRegistration $registration) {}

    protected function noticeType(): string
    {
        return 'registration.confirmation';
    }

    protected function subjectLine(): string
    {
        return "Inscrição confirmada: {$this->registration->event->title}";
    }

    protected function template(): string
    {
        return 'notice';
    }

    protected function data(): array
    {
        $event = $this->registration->event;

        return [
            'heading' => $this->subjectLine(),
            'lines' => [
                "Olá, {$this->registration->participant_name}. Recebemos a sua inscrição em {$event->title}.",
                'Quando: '.$event->starts_at->copy()->timezone('America/Sao_Paulo')->format('d/m/Y \à\s H\hi').'.',
                "Onde: {$event->location}.",
                'Se precisar corrigir ou cancelar a inscrição, fale com a secretaria da igreja.',
            ],
            'actionLabel' => 'Ver o evento',
            'actionUrl' => rtrim((string) config('app.url'), '/').'/eventos/'.$event->slug,
        ];
    }
}
