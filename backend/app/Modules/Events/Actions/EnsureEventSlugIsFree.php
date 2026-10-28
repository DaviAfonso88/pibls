<?php

declare(strict_types=1);

namespace App\Modules\Events\Actions;

use App\Modules\Events\Models\Event;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * O endereço (slug) é único entre os eventos (BR-032). Conferido antes de gravar, para devolver a mensagem certa; o
 * índice único (`uq_events_slug`) segue como garantia contra duas requisições ao mesmo tempo.
 */
final class EnsureEventSlugIsFree
{
    public function __invoke(string $slug, ?int $ignoreEventId = null): void
    {
        $taken = Event::query()
            ->where('slug', $slug)
            ->when($ignoreEventId !== null, fn ($query) => $query->whereKeyNot($ignoreEventId))
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
    public function guard(callable $save): mixed
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
