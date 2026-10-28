<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Enums;

/**
 * Categoria de um item do catálogo (Domain Model → MinistryGroup). Célula de CL exige bairro e horário (BR-049).
 */
enum MinistryCategory: string
{
    case Ministerio = 'MINISTERIO';
    case Grupo = 'GRUPO';
    case Celula = 'CELULA';
}
