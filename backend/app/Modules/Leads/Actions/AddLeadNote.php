<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use Illuminate\Validation\ValidationException;

/**
 * A anotação interna do atendimento (BR-013): até 1.000 caracteres, com ou sem mudança de status. Texto só de espaços
 * vale como "sem anotação".
 */
final class AddLeadNote
{
    public const MAX_LENGTH = 1000;

    public function __invoke(?string $note): ?string
    {
        $note = $note === null ? null : trim($note);

        if ($note === null || $note === '') {
            return null;
        }

        if (mb_strlen($note) > self::MAX_LENGTH) {
            throw ValidationException::withMessages(['note' => [__('business.BR-013')]]);
        }

        return $note;
    }
}
