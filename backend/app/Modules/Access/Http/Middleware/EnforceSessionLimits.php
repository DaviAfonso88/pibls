<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tempo máximo da sessão (Security → Autenticação): 12 h desde o login, não importa a atividade. A inatividade de
 * 60 min é do próprio driver de sessão (`SESSION_LIFETIME`). O login grava `login_at` na sessão; sessão autenticada sem
 * ele não foi aberta por nós e é encerrada também.
 */
final class EnforceSessionLimits
{
    /** Chave da sessão com o instante do login (segundos desde a época). */
    public const LOGIN_AT = 'login_at';

    /** 12 horas. */
    public const MAX_AGE_SECONDS = 43_200;

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() === null) {
            return $next($request);
        }

        $loginAt = $request->session()->get(self::LOGIN_AT);

        if (! is_int($loginAt) || time() - $loginAt > self::MAX_AGE_SECONDS) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw new AuthenticationException;
        }

        return $next($request);
    }
}
