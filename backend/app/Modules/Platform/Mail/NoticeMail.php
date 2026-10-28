<?php

declare(strict_types=1);

namespace App\Modules\Platform\Mail;

/**
 * Aviso transacional simples: título, alguns parágrafos e, se houver, um botão. Serve aos avisos que não precisam de
 * layout próprio (ex.: "Sua senha foi alterada", alerta de PIX) e é o e-mail de referência dos testes da fila.
 */
final class NoticeMail extends BaseMail
{
    /**
     * @param  string  $type  tipo do aviso para o log (`password.changed`); nunca leva dado pessoal
     * @param  list<string>  $lines  parágrafos, em texto puro (a view os escapa)
     */
    public function __construct(
        private readonly string $type,
        private readonly string $subjectText,
        private readonly string $heading,
        private readonly array $lines,
        private readonly ?string $actionLabel = null,
        private readonly ?string $actionUrl = null,
    ) {}

    protected function noticeType(): string
    {
        return $this->type;
    }

    protected function subjectLine(): string
    {
        return $this->subjectText;
    }

    protected function template(): string
    {
        return 'notice';
    }

    protected function data(): array
    {
        return [
            'heading' => $this->heading,
            'lines' => $this->lines,
            'actionLabel' => $this->actionLabel,
            'actionUrl' => $this->actionUrl,
        ];
    }
}
