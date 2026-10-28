<?php

declare(strict_types=1);

namespace App\Shared\Sanitizer;

use Stringable;

/**
 * HTML que já passou pela lista de permissão do servidor (`HtmlSanitizer`). É o único HTML que o projeto grava
 * (`body`, `description`) e o único que o frontend renderiza com `dangerouslySetInnerHTML`.
 *
 * `wasModified` alimenta o aviso do editor (BR-046): "Parte da formatação não é permitida e foi removida."
 */
final readonly class SanitizedHtml implements Stringable
{
    public function __construct(
        public string $html,
        public bool $wasModified,
    ) {}

    /** Texto puro, sem marcação: base do `excerpt` do Open Graph e da contagem de caracteres. */
    public function plainText(): string
    {
        $text = html_entity_decode(strip_tags(str_replace(['</p>', '</li>', '</h2>', '</h3>', '</blockquote>', '<br>', '<br/>', '<br />'], ' ', $this->html)), ENT_QUOTES | ENT_HTML5, 'UTF-8');

        return trim((string) preg_replace('/\s+/u', ' ', $text));
    }

    public function textLength(): int
    {
        return mb_strlen($this->plainText());
    }

    public function __toString(): string
    {
        return $this->html;
    }
}
