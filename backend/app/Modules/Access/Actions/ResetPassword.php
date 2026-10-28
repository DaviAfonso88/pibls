<?php

declare(strict_types=1);

namespace App\Modules\Access\Actions;

use App\Modules\Access\Events\PasswordChanged;
use App\Modules\Access\Models\User;
use App\Shared\Http\UnprocessableRuleException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;

/**
 * Define a nova senha com o token do link (BR-072: uso único, 60 min). A política de senha (BR-073) já foi validada
 * pelo Form Request. Token errado, expirado, já usado, e-mail desconhecido ou usuário inativo respondem todos com
 * `INVALID_RESET_TOKEN`, sem distinguir. O evento `PasswordChanged` apaga as sessões do usuário e enfileira o aviso.
 */
final class ResetPassword
{
    public function __invoke(string $email, string $token, string $password): void
    {
        $email = mb_strtolower(trim($email));

        $isActive = User::query()->where('email', $email)->where('is_active', true)->exists();
        if (! $isActive) {
            throw $this->invalidToken();
        }

        $changedUserId = null;

        // Closure comum (e não `fn`): a variável precisa ser capturada por referência para sair da transação
        $status = DB::transaction(function () use ($email, $token, $password, &$changedUserId) {
            return Password::broker()->reset(
                ['email' => $email, 'token' => $token, 'password' => $password],
                function (User $user, string $plain) use (&$changedUserId): void {
                    // BR-077: em `users`, a aplicação só grava a senha (o cast `hashed` aplica o bcrypt de custo 12) e as datas
                    $user->forceFill(['password' => $plain, 'password_changed_at' => Carbon::now('UTC')])->save();
                    $changedUserId = (int) $user->getKey();
                },
            );
        });

        if ($status !== Password::PasswordReset || $changedUserId === null) {
            throw $this->invalidToken();
        }

        event(new PasswordChanged($changedUserId));
    }

    private function invalidToken(): UnprocessableRuleException
    {
        return new UnprocessableRuleException('INVALID_RESET_TOKEN', __('business.BR-072'));
    }
}
