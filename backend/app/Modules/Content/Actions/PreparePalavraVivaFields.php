<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Support\YouTubeUrl;
use App\Shared\Sanitizer\HtmlSanitizer;
use App\Shared\Support\PostExcerpt;
use Illuminate\Validation\ValidationException;

/**
 * Os campos derivados de uma mensagem, comuns a criar e alterar: o corpo sanitizado no servidor (BR-046), o resumo
 * gerado dele e o id do vídeo tirado do link (BR-044). Nada do que o navegador mandou é gravado sem passar por aqui.
 */
final class PreparePalavraVivaFields
{
    public function __construct(private readonly HtmlSanitizer $sanitizer) {}

    /**
     * @param  array<string, mixed>  $input  `body` e/ou `youtube_url`, só o que foi enviado
     * @return array{fields: array<string, mixed>, sanitizationWarning: bool}
     */
    public function __invoke(array $input): array
    {
        $fields = [];
        $warning = false;

        if (array_key_exists('body', $input)) {
            $clean = $this->sanitizer->sanitize((string) $input['body']);

            // Um corpo que só tinha marcação proibida (um `<script>` sozinho) ficaria vazio depois de sanitizado
            if ($clean->plainText() === '') {
                throw ValidationException::withMessages(['body' => [__('errors.palavra_viva_empty_body')]]);
            }

            $fields['body'] = $clean->html;
            $fields['excerpt'] = PostExcerpt::from($clean);
            $warning = $clean->wasModified;
        }

        if (array_key_exists('youtube_url', $input)) {
            $link = $input['youtube_url'] === null || $input['youtube_url'] === '' ? null : YouTubeUrl::tryParse((string) $input['youtube_url']);

            if ($input['youtube_url'] !== null && $input['youtube_url'] !== '' && $link === null) {
                throw ValidationException::withMessages(['youtube_url' => [__('business.BR-044')]]);
            }

            $fields['youtube_url'] = $link?->canonical();
            $fields['youtube_video_id'] = $link?->videoId;
        }

        return ['fields' => $fields, 'sanitizationWarning' => $warning];
    }
}
