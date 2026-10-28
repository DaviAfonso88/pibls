<?php

declare(strict_types=1);

namespace App\Modules\Access\Authentication;

use App\Shared\Http\RateLimiters;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Bloqueio de login por força bruta (BR-071; API Standards → Limites por rota): 5 falhas em 15 min para o mesmo
 * (e-mail + IP) bloqueiam esse par por 15 min. O limite de 20 requisições por 15 min por IP é do limitador `login`
 * da rota; este aqui conta só as FALHAS, de modo que quem acerta a senha nunca é bloqueado por quem erra.
 *
 * As chaves guardam apenas o hash do par, nunca o e-mail (sem dado pessoal no cache).
 */
final class LoginThrottle
{
    public const MAX_FAILURES = 5;

    public const WINDOW_SECONDS = 900;

    public const LOCK_SECONDS = 900;

    /** Segundos que faltam para o bloqueio acabar; 0 se o par não está bloqueado. */
    public function lockedFor(string $email, ?string $ip): int
    {
        $lock = $this->lockKey($email, $ip);

        return RateLimiter::tooManyAttempts($lock, 1) ? max(1, RateLimiter::availableIn($lock)) : 0;
    }

    public function recordFailure(string $email, ?string $ip): void
    {
        $failures = $this->failuresKey($email, $ip);

        RateLimiter::hit($failures, self::WINDOW_SECONDS);

        if (RateLimiter::attempts($failures) >= self::MAX_FAILURES) {
            RateLimiter::hit($this->lockKey($email, $ip), self::LOCK_SECONDS);
            RateLimiter::clear($failures);
        }
    }

    public function clear(string $email, ?string $ip): void
    {
        RateLimiter::clear($this->failuresKey($email, $ip));
    }

    private function failuresKey(string $email, ?string $ip): string
    {
        return 'login-failures:'.RateLimiters::hash($email.'|'.$ip);
    }

    private function lockKey(string $email, ?string $ip): string
    {
        return 'login-lock:'.RateLimiters::hash($email.'|'.$ip);
    }
}
