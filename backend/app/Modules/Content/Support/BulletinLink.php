<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use Closure;

/**
 * Link de um boletim publicado fora do site, como um flipbook do Heyzine (BR-084, ADR-026). Vale qualquer serviço, mas só
 * `https`, com um domínio de verdade e sem usuário ou senha no endereço. O servidor nunca acessa o link: ele só vira o
 * destino de "Ler boletim", que abre em nova aba.
 */
final readonly class BulletinLink
{
    public const MAX_LENGTH = 500;

    private const FORMAT = '#^https://[^\s[:cntrl:]]+$#iD';

    private const DOMAIN = '/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z](?:[a-z0-9-]*[a-z0-9])$/iD';

    private function __construct(public string $url) {}

    public static function tryParse(?string $value): ?self
    {
        $value = trim((string) $value);
        if (strlen($value) > self::MAX_LENGTH || preg_match(self::FORMAT, $value) !== 1) {
            return null;
        }

        $parts = parse_url($value);
        if ($parts === false || ! isset($parts['host']) || isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        return preg_match(self::DOMAIN, $parts['host']) === 1 ? new self($value) : null;
    }

    /** A regra de validação dos Form Requests, com a mensagem da BR-084. */
    public static function rule(): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || self::tryParse($value) === null) {
                $fail(__('business.BR-084.0'));
            }
        };
    }
}
