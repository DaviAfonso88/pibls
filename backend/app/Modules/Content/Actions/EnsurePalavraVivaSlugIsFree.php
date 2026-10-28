<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\PalavraVivaPost;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * O endereço (slug) é único entre as mensagens não excluídas (BR-032). Conferido antes de gravar, para devolver a
 * mensagem certa; o índice único (`slug_active`) segue como garantia contra duas requisições ao mesmo tempo.
 */
final class EnsurePalavraVivaSlugIsFree
{
    public function __invoke(string $slug, ?int $ignorePostId = null): void
    {
        $taken = PalavraVivaPost::query()
            ->where('slug', $slug)
            ->when($ignorePostId !== null, fn ($query) => $query->whereKeyNot($ignorePostId))
            ->exists();

        if ($taken) {
            throw self::duplicate();
        }
    }

    /**
     * Roda a gravação e transforma a violação do índice único (corrida entre duas requisições) no mesmo 409.
     *
     * @template T
     *
     * @param  callable(): T  $save
     * @return T
     */
    public function guard(string $slug, callable $save): mixed
    {
        try {
            return $save();
        } catch (UniqueConstraintViolationException) {
            throw self::duplicate();
        }
    }

    public static function duplicate(): BusinessRuleException
    {
        return new BusinessRuleException('DUPLICATE_SLUG', __('business.BR-032'));
    }
}
