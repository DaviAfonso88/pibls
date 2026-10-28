<?php

declare(strict_types=1);

namespace App\Modules\Leads\Mail;

use App\Modules\Leads\Enums\LeadType;
use App\Modules\Platform\Mail\BaseMail;
use Carbon\CarbonImmutable;

/**
 * Aviso à equipe de que chegou um contato (CAP-05): o tipo, a data (horário de Brasília) e o link do contato no painel.
 * NUNCA leva o conteúdo: nem a mensagem, nem nome, telefone ou e-mail de quem escreveu. No pedido de oração (BR-007) o
 * aviso diz expressamente que o texto só se lê no painel. Leva só identificadores, então o job na fila também não guarda
 * dado pessoal.
 */
final class LeadReceivedMail extends BaseMail
{
    public function __construct(
        private readonly int $leadId,
        private readonly LeadType $type,
        private readonly CarbonImmutable $receivedAt,
    ) {}

    protected function noticeType(): string
    {
        return 'lead.received';
    }

    protected function subjectLine(): string
    {
        return $this->type === LeadType::Oracao
            ? 'Novo pedido de oração'
            : "Novo contato: {$this->type->label()}";
    }

    protected function template(): string
    {
        return 'notice';
    }

    protected function data(): array
    {
        $lines = [
            $this->type === LeadType::Oracao
                ? 'Chegou um novo pedido de oração pelo site.'
                : 'Chegou um novo contato pelo site.',
            "Tipo: {$this->type->label()}.",
            'Recebido em '.$this->receivedAt->timezone('America/Sao_Paulo')->format('d/m/Y \à\s H\hi').'.',
        ];

        if ($this->type === LeadType::Oracao) {
            $lines[] = 'Por respeito a quem pediu, o texto do pedido não vai por e-mail. Abra o painel para lê-lo.';
        }

        return [
            'heading' => $this->subjectLine(),
            'lines' => $lines,
            'actionLabel' => $this->type === LeadType::Oracao ? 'Abrir o pedido' : 'Abrir o contato',
            'actionUrl' => rtrim((string) config('app.url'), '/').$this->type->panelPath($this->leadId),
        ];
    }
}
