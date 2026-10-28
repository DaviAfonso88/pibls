<?php

declare(strict_types=1);

namespace App\Modules\Content\Events;

use Carbon\CarbonImmutable;

/**
 * Os dados PIX mudaram (CAP-18). Dois listeners reagem, ambos síncronos e na transação da alteração: a auditoria com o
 * valor anterior e o novo, e o alerta por e-mail, que entra na fila dos destinatários do servidor (BR-063).
 *
 * `before` e `after` guardam só o que não é pessoal nem secreto: a chave (CNPJ), o favorecido e se há QR Code e código
 * Copia e Cola. O QR e o código em si não vão para a auditoria nem para o e-mail.
 */
final readonly class PixSettingsChanged
{
    /**
     * @param  array{pix_key: string, beneficiary_name: string, has_qr_image: bool, has_copy_paste_code: bool}  $before
     * @param  array{pix_key: string, beneficiary_name: string, has_qr_image: bool, has_copy_paste_code: bool}  $after
     * @param  list<string>  $changedFields  `pix_key`, `beneficiary_name`, `qr_image`, `copy_paste_code`
     */
    public function __construct(
        public int $actorId,
        public string $actorName,
        public array $before,
        public array $after,
        public array $changedFields,
        public CarbonImmutable $at,
    ) {}
}
