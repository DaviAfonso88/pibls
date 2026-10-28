<?php

declare(strict_types=1);

namespace App\Modules\Access\Actions;

use App\Modules\Access\Authentication\LoginThrottle;
use App\Modules\Access\Http\Middleware\EnforceSessionLimits;
use App\Modules\Access\Models\User;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Shared\Http\TooManyAttemptsException;
use App\Shared\Http\UnprocessableRuleException;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

/**
 * Login do painel (CAP-08). BR-070: e-mail inexistente, senha errada e usuário inativo respondem exatamente igual (e
 * com o mesmo custo de bcrypt, para o tempo não denunciar se o e-mail existe). BR-071: depois de 5 falhas seguidas do
 * mesmo (e-mail + IP), o par fica bloqueado por 15 min. O sucesso regenera o id da sessão (contra fixação), marca o
 * instante do login para o limite de 12 h e grava `last_login_at`.
 */
final class Login
{
    /**
     * Hash bcrypt (custo 12) de uma senha que ninguém conhece. Quem erra o e-mail paga o mesmo `Hash::check` de quem erra
     * a senha.
     */
    private const TIMING_HASH = '$2y$12$1f1cKOJCWftYLQv7fv8Sn.DVcRHBDs0T7t.S/Jf5iijlIWzdWdNDW';

    public function __construct(
        private readonly LoginThrottle $throttle,
        private readonly AuditLogger $audit,
    ) {}

    public function __invoke(Request $request, string $email, string $password): User
    {
        $email = mb_strtolower(trim($email));
        $ip = $request->ip();

        $lockedFor = $this->throttle->lockedFor($email, $ip);
        if ($lockedFor > 0) {
            $this->audit->record(AuditAction::LoginFailed, 'user', null, ['reason' => 'locked']);

            throw new TooManyAttemptsException(__('business.BR-071'), $lockedFor);
        }

        $user = User::query()->where('email', $email)->first();
        $passwordMatches = Hash::check($password, $user === null ? self::TIMING_HASH : $user->password);

        if ($user === null || ! $user->is_active || ! $passwordMatches) {
            $this->throttle->recordFailure($email, $ip);
            $this->audit->record(
                AuditAction::LoginFailed,
                'user',
                $user?->getKey(),
                ['reason' => $user === null ? 'unknown' : ($user->is_active ? 'password' : 'inactive')],
            );

            throw new UnprocessableRuleException('INVALID_CREDENTIALS', __('business.BR-070'));
        }

        $this->throttle->clear($email, $ip);

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put(EnforceSessionLimits::LOGIN_AT, time());

        // BR-077: a aplicação só grava senha e datas de login em `users`
        User::query()->whereKey($user->getKey())->update(['last_login_at' => Carbon::now('UTC')]);
        $user->refresh();

        $this->audit->record(AuditAction::LoginSucceeded, 'user', $user->getKey(), actorUserId: (int) $user->getKey());
        Log::info('auth.login', ['userId' => $user->getKey()]);

        return $user;
    }
}
