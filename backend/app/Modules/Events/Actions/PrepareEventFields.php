<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Shared\Sanitizer\HtmlSanitizer;
use App\Shared\Support\PostExcerpt;
use Illuminate\Validation\ValidationException;

/**
 * Os campos derivados da descrição de um evento, comuns a criar e alterar: o HTML sanitizado no servidor (BR-046) e o
 * resumo (`excerpt`, até 300 caracteres) gerado dele, que alimenta o Open Graph e o JSON-LD. Nada do que o navegador
 * mandou é gravado sem passar por aqui.
 */
final class PrepareEventFields
{
    public function __construct(private readonly HtmlSanitizer $sanitizer) {}

    /**
     * @return array{fields: array{description: string, excerpt: string}, sanitizationWarning: bool}
     */
    public function __invoke(string $description): array
    {
        $clean = $this->sanitizer->sanitize($description);

        // Uma descrição que só tinha marcação proibida (um `<script>` sozinho) ficaria vazia depois de sanitizada
        if ($clean->plainText() === '') {
            throw ValidationException::withMessages(['description' => [__('errors.event_empty_description')]]);
        }

        return [
            'fields' => ['description' => $clean->html, 'excerpt' => PostExcerpt::from($clean)],
            'sanitizationWarning' => $clean->wasModified,
        ];
    }
}
