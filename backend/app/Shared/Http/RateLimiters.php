<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Limiters nomeados de API Standards → Limites por rota. O store é `database` (CACHE_STORE), sem Redis.
 *
 * O valor bruto de IP, telefone ou e-mail nunca vira chave de cache: só o hash. Estourar o limite responde 429
 * com `Retry-After` e `X-RateLimit-*` (cabeçalhos do próprio Laravel) no envelope de erro, e registra um `warning`
 * com o hash do IP, que é o único caso em que o IP pode aparecer no log.
 *
 * O limite de 5 falhas de login por (e-mail + IP) é contado pela Action de login, só nas falhas (BR-071);
 * o limiter `login` abaixo é o teto de 20 tentativas por IP.
 */
final class RateLimiters
{
    public const PUBLIC_READ = 'public-read';

    public const LEAD_SUBMIT = 'lead-submit';

    public const REGISTRATION_SUBMIT = 'registration-submit';

    public const LOGIN = 'login';

    public const PASSWORD_FORGOT = 'password-forgot';

    public const PASSWORD_RESET = 'password-reset';

    public const ADMIN = 'admin';

    public const ADMIN_EXPORT = 'admin-export';

    public static function register(): void
    {
        // Wi-Fi da igreja: muitos visitantes compartilham um IP, então a leitura pública é generosa.
        RateLimiter::for(self::PUBLIC_READ, fn (Request $request) => [
            self::limit(self::PUBLIC_READ, Limit::perMinute(300), 'ip', $request->ip()),
        ]);

        RateLimiter::for(self::LEAD_SUBMIT, function (Request $request) {
            $limits = [self::limit(self::LEAD_SUBMIT, Limit::perMinutes(10, 10), 'ip', $request->ip())];

            foreach (self::contactKeys($request) as $kind => $value) {
                $limits[] = self::limit(self::LEAD_SUBMIT, Limit::perMinutes(10, 3), $kind, $value);
            }

            return $limits;
        });

        // O IP pesa mais que o telefone: o anúncio das inscrições no culto chega com o Wi-Fi da igreja.
        RateLimiter::for(self::REGISTRATION_SUBMIT, function (Request $request) {
            $limits = [self::limit(self::REGISTRATION_SUBMIT, Limit::perMinutes(10, 60), 'ip', $request->ip())];

            $phone = self::phoneDigits($request);
            if ($phone !== null) {
                $limits[] = self::limit(self::REGISTRATION_SUBMIT, Limit::perMinutes(10, 5), 'phone', $phone);
            }

            return $limits;
        });

        RateLimiter::for(self::LOGIN, fn (Request $request) => [
            self::limit(self::LOGIN, Limit::perMinutes(15, 20), 'ip', $request->ip()),
        ]);

        RateLimiter::for(self::PASSWORD_FORGOT, function (Request $request) {
            $limits = [self::limit(self::PASSWORD_FORGOT, Limit::perHour(10), 'ip', $request->ip())];

            $email = self::email($request);
            if ($email !== null) {
                $limits[] = self::limit(self::PASSWORD_FORGOT, Limit::perHour(3), 'email', $email);
            }

            return $limits;
        });

        RateLimiter::for(self::PASSWORD_RESET, fn (Request $request) => [
            self::limit(self::PASSWORD_RESET, Limit::perHour(10), 'ip', $request->ip()),
        ]);

        RateLimiter::for(self::ADMIN, fn (Request $request) => [
            self::limit(self::ADMIN, Limit::perMinute(120), 'user', self::userKey($request)),
        ]);

        RateLimiter::for(self::ADMIN_EXPORT, fn (Request $request) => [
            self::limit(self::ADMIN_EXPORT, Limit::perMinutes(10, 10), 'user', self::userKey($request)),
        ]);
    }

    /** Hash estável do valor, para a chave de cache e para o log. */
    public static function hash(?string $value): string
    {
        return hash('sha256', $value ?? '');
    }

    private static function limit(string $name, Limit $limit, string $kind, ?string $value): Limit
    {
        return $limit
            ->by($kind.':'.self::hash($value))
            ->response(self::tooManyRequests($name));
    }

    private static function tooManyRequests(string $name): Closure
    {
        return function (Request $request, array $headers) use ($name): never {
            Log::warning('rate_limit.hit', ['limiter' => $name, 'ipHash' => self::hash($request->ip())]);

            throw new ThrottleRequestsException(headers: $headers);
        };
    }

    /**
     * @return array<string, string> telefone (só dígitos) e/ou e-mail (minúsculas) informados no corpo
     */
    private static function contactKeys(Request $request): array
    {
        $keys = [];

        $phone = self::phoneDigits($request);
        if ($phone !== null) {
            $keys['phone'] = $phone;
        }

        $email = self::email($request);
        if ($email !== null) {
            $keys['email'] = $email;
        }

        return $keys;
    }

    private static function phoneDigits(Request $request): ?string
    {
        $phone = $request->input('phone');
        if (! is_string($phone)) {
            return null;
        }

        $digits = (string) preg_replace('/\D+/', '', $phone);

        // "+55 31 …" e "31 …" são a mesma pessoa: sem isto, o DDI burlaria o limite por telefone.
        if (strlen($digits) > 11 && str_starts_with($digits, '55')) {
            $digits = substr($digits, 2);
        }

        return $digits === '' ? null : $digits;
    }

    private static function email(Request $request): ?string
    {
        $email = $request->input('email');
        if (! is_string($email) || trim($email) === '') {
            return null;
        }

        return mb_strtolower(trim($email));
    }

    private static function userKey(Request $request): string
    {
        $id = $request->user()?->getAuthIdentifier();

        return is_scalar($id) ? 'id-'.$id : 'ip-'.($request->ip() ?? '');
    }
}
