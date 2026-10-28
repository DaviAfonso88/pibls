<?php

declare(strict_types=1);

namespace App\Modules\Events\ValueObjects;

use InvalidArgumentException;

/**
 * As respostas não cumprem o formulário vigente (BR-024). Leva uma mensagem por campo, pela `key` do campo no schema.
 */
final class InvalidRegistrationAnswers extends InvalidArgumentException
{
    /**
     * @param  array<string, string>  $errors  `key` do campo => mensagem pt-BR
     */
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Respostas inválidas para o formulário do evento.');
    }
}
