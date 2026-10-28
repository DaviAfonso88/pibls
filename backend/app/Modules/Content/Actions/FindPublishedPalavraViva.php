<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * A mensagem pública pelo endereço. Agendada, excluída ou inexistente é a mesma coisa para quem pergunta: 404 (BR-042).
 */
final class FindPublishedPalavraViva
{
    public function __invoke(string $slug): PalavraVivaPost
    {
        $post = PalavraVivaPost::query()->published()->where('slug', $slug)->first();

        if ($post === null) {
            throw (new ModelNotFoundException)->setModel(PalavraVivaPost::class);
        }

        return $post;
    }

    public function exists(string $slug): ?PalavraVivaPost
    {
        return PalavraVivaPost::query()->published()->where('slug', $slug)->first();
    }
}
