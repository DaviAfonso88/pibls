<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\Bulletin;
use App\Shared\Http\BusinessRuleException;

/**
 * A edição é única entre os boletins não excluídos (BR-040). Conferida antes de gravar para devolver a mensagem certa;
 * o índice único (`edition_number_active`) continua sendo a garantia contra duas requisições ao mesmo tempo.
 */
final class EnsureBulletinEditionIsFree
{
    public function __invoke(int $edition, ?int $ignoreBulletinId = null): void
    {
        $taken = Bulletin::query()
            ->where('edition_number', $edition)
            ->when($ignoreBulletinId !== null, fn ($query) => $query->whereKeyNot($ignoreBulletinId))
            ->exists();

        if ($taken) {
            throw self::duplicate($edition);
        }
    }

    public static function duplicate(int $edition): BusinessRuleException
    {
        // O texto da regra (architecture.md) traz o "N" no lugar do número da edição
        return new BusinessRuleException('DUPLICATE_EDITION', str_replace('N.', $edition.'.', __('business.BR-040')));
    }
}
