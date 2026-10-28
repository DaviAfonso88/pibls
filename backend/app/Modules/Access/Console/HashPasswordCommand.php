<?php

declare(strict_types=1);

namespace App\Modules\Access\Console;

use App\Modules\Access\Rules\StrongPassword;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

/**
 * `php artisan pibls:hash-password`: gera o hash bcrypt (custo 12) de uma senha, para colar na coluna `users.password` no
 * phpMyAdmin ao provisionar um usuário (BR-077; o servidor não tem SSH, então roda na máquina de quem provisiona).
 *
 * A senha é pedida sem eco, passa pela mesma política da aplicação (BR-073) e nunca é impressa nem gravada em lugar nenhum:
 * sai só o hash.
 */
final class HashPasswordCommand extends Command
{
    protected $signature = 'pibls:hash-password';

    protected $description = 'Gera o hash bcrypt de uma senha para provisionar um usuário no phpMyAdmin (BR-077)';

    public function handle(StrongPassword $policy): int
    {
        $password = $this->secret('Senha (mínimo de 12 caracteres, não aparece na tela)');
        $confirmation = $this->secret('Repita a senha');

        if (! is_string($password) || $password !== $confirmation) {
            $this->error('As duas senhas não são iguais.');

            return self::FAILURE;
        }

        $validator = Validator::make(['password' => $password], ['password' => [$policy]]);
        if ($validator->fails()) {
            $this->error((string) $validator->errors()->first('password'));

            return self::FAILURE;
        }

        $this->line(Hash::driver('bcrypt')->make($password, ['rounds' => 12]));

        return self::SUCCESS;
    }
}
