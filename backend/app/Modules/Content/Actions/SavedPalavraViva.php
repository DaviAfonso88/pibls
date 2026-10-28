<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;

/**
 * Resultado de gravar uma mensagem: o registro e se o servidor removeu formatação não permitida do corpo (BR-046).
 */
final readonly class SavedPalavraViva
{
    public function __construct(
        public PalavraVivaPost $post,
        public bool $sanitizationWarning,
    ) {}
}
