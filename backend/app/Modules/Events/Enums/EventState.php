<?php

declare(strict_types=1);

namespace App\Modules\Events\Enums;

/**
 * Estado derivado de um evento (data-model → Events): nunca é gravado, sai da publicação, das datas, do prazo e das vagas.
 */
enum EventState: string
{
    case Draft = 'RASCUNHO';
    case RegistrationOpen = 'INSCRICOES_ABERTAS';
    case RegistrationClosed = 'INSCRICOES_ENCERRADAS';
    case Held = 'REALIZADO';
}
