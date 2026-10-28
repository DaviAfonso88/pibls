<?php

declare(strict_types=1);

namespace App\Modules\Content\Mail;

use App\Modules\Platform\Mail\BaseMail;
use App\Shared\ValueObjects\Cnpj;
use Carbon\CarbonImmutable;

/**
 * Alerta de que os dados PIX mudaram (CAP-18): quem alterou, quando, o que mudou e os valores que passaram a valer no
 * site. Serve para a Tesouraria e a liderança perceberem uma troca indevida a tempo (RK-08). Leva o nome do operador
 * (equipe), nunca dado de quem contribui, e nunca o QR nem o código Copia e Cola.
 */
final class PixAlertMail extends BaseMail
{
    private const FIELD_LABELS = [
        'pix_key' => 'a chave',
        'beneficiary_name' => 'o nome do favorecido',
        'qr_image' => 'o QR Code',
        'copy_paste_code' => 'o código Pix Copia e Cola',
    ];

    /**
     * @param  list<string>  $changedFields
     */
    public function __construct(
        private readonly string $operatorName,
        private readonly array $changedFields,
        private readonly string $pixKey,
        private readonly string $beneficiary,
        private readonly CarbonImmutable $changedAt,
    ) {}

    protected function noticeType(): string
    {
        return 'pix.changed';
    }

    protected function subjectLine(): string
    {
        return 'Atenção: os dados PIX do site foram alterados';
    }

    protected function template(): string
    {
        return 'notice';
    }

    protected function data(): array
    {
        $labels = array_map(fn (string $field): string => self::FIELD_LABELS[$field] ?? $field, $this->changedFields);
        $key = Cnpj::tryFrom($this->pixKey)?->formatted() ?? $this->pixKey;

        return [
            'heading' => $this->subjectLine(),
            'lines' => [
                "{$this->operatorName} alterou ".$this->joinLabels($labels).' da página Contribua, em '
                    .$this->changedAt->timezone('America/Sao_Paulo')->format('d/m/Y \à\s H\hi').'.',
                "Passou a valer: chave {$key}, favorecido {$this->beneficiary}.",
                'Se a alteração foi legítima, não precisa fazer nada. Se não foi, troque as senhas do painel e siga o runbook "PIX alterado indevidamente".',
            ],
            'actionLabel' => 'Conferir a página Contribua',
            'actionUrl' => rtrim((string) config('app.url'), '/').'/contribua',
        ];
    }

    /**
     * @param  list<string>  $labels
     */
    private function joinLabels(array $labels): string
    {
        if (count($labels) <= 1) {
            return $labels[0] ?? 'os dados';
        }

        return implode(', ', array_slice($labels, 0, -1)).' e '.$labels[array_key_last($labels)];
    }
}
