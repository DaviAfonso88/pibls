<?php

declare(strict_types=1);

namespace App\Shared\Support;

use App\Shared\Sanitizer\SanitizedHtml;

/**
 * Resumo de uma mensagem (`excerpt`, até 300 caracteres): o texto puro do corpo já sanitizado, cortado sem partir palavra.
 * Alimenta a lista, o Open Graph e o JSON-LD.
 */
final class PostExcerpt
{
    public const MAX_LENGTH = 300;

    public static function from(SanitizedHtml $body): string
    {
        $text = $body->plainText();

        if (mb_strlen($text) <= self::MAX_LENGTH) {
            return $text;
        }

        $cut = mb_substr($text, 0, self::MAX_LENGTH - 1);
        $lastSpace = mb_strrpos($cut, ' ');
        // Corta na última palavra inteira, a menos que ela seja tão longa que sobraria quase nada
        if ($lastSpace !== false && $lastSpace > self::MAX_LENGTH / 2) {
            $cut = mb_substr($cut, 0, $lastSpace);
        }

        return rtrim($cut, " \t\n\r\0\x0B.,;:").'…';
    }
}
