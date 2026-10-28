<?php

declare(strict_types=1);

namespace App\Modules\Access\Events;

/** A senha de um usuário mudou (redefinição). Só o id viaja: o ouvinte busca o resto. */
final class PasswordChanged
{
    public function __construct(public readonly int $userId) {}
}
