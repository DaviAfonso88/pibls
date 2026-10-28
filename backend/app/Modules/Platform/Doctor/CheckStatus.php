<?php

declare(strict_types=1);

namespace App\Modules\Platform\Doctor;

/**
 * Resultado de uma checagem do `pibls:doctor`. Só `Error` impede a ativação de uma release.
 */
enum CheckStatus: string
{
    case Ok = 'ok';

    /** Funciona, mas foge do desejado (ex.: pouco espaço em disco). Aparece no relatório e não bloqueia. */
    case Warning = 'warning';

    /** A aplicação não vai funcionar direito: bloqueia a ativação. */
    case Error = 'error';
}
