<?php

declare(strict_types=1);

namespace App\Shared\Support;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * O `published_at` que o painel envia. Com fuso (`2026-11-08T09:00:00-03:00` ou `Z`), vale o fuso enviado; sem fuso
 * (`2026-11-08T09:00`), vale o horário de Brasília (o painel agenda em America/Sao_Paulo). Sai sempre em UTC, que é
 * como o banco guarda.
 */
final class PublicationInstant
{
    private const LOCAL_ZONE = 'America/Sao_Paulo';

    public static function parse(?string $value): ?CarbonImmutable
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return CarbonImmutable::parse($value, self::LOCAL_ZONE)->utc();
        } catch (Throwable) {
            return null;
        }
    }
}
