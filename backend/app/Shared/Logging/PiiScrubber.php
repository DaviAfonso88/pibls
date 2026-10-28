<?php

declare(strict_types=1);

namespace App\Shared\Logging;

/**
 * Remove dado pessoal de qualquer estrutura que vá para o log ou para o Sentry.
 *
 * Regra do projeto: nunca registrar corpo de requisição, senha, token, cookie, campo 🔒, nem telefone ou e-mail
 * do público (Observability → Logging). Chaves proibidas perdem o valor; textos livres têm e-mails e telefones
 * mascarados, porque uma exceção ou uma mensagem pode carregar o dado dentro da frase.
 */
final class PiiScrubber
{
    public const REDACTED = '[removido]';

    /** Trechos que, no nome da chave, indicam dado pessoal ou segredo. */
    private const SENSITIVE_KEY_PARTS = [
        'password', 'senha', 'passwd', 'secret', 'token', 'cookie', 'authorization', 'api_key', 'apikey',
        'email', 'e-mail', 'phone', 'telefone', 'celular', 'whatsapp', 'cpf', 'cnpj',
        'message', 'mensagem', 'note', 'anotacao', 'body', 'payload', 'answers', 'respostas',
        'address', 'endereco', 'private_address', 'guardian', 'participant_name',
    ];

    /** Chaves curtas demais para casar por trecho (`route_name`, `hostname`): valem só quando iguais. */
    private const SENSITIVE_EXACT_KEYS = ['name', 'nome', 'first_name', 'last_name', 'full_name', 'ip', 'ip_address', 'user_agent'];

    /** Chaves que parecem sensíveis mas são metadados seguros e úteis para investigar um problema. */
    private const ALLOWED_KEYS = ['request_id', 'correlationid', 'ipHash', 'iphash', 'limiter', 'route', 'action'];

    private const EMAIL_PATTERN = '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i';

    /** Telefone brasileiro com ou sem máscara, DDI e DDD: (31) 99999-8888, +55 31 99999-8888, 31999998888. */
    private const PHONE_PATTERN = '/(?<![\d])(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}(?![\d])/';

    /**
     * @param  mixed  $value
     * @return mixed
     */
    public static function scrub($value, ?string $key = null)
    {
        if ($key !== null && self::isSensitiveKey($key)) {
            return self::REDACTED;
        }

        if (is_array($value)) {
            $clean = [];
            foreach ($value as $childKey => $child) {
                $clean[$childKey] = self::scrub($child, is_string($childKey) ? $childKey : null);
            }

            return $clean;
        }

        if (is_string($value)) {
            return self::scrubText($value);
        }

        return $value;
    }

    /** Mascara e-mails e telefones dentro de um texto livre. */
    public static function scrubText(string $text): string
    {
        $text = (string) preg_replace(self::EMAIL_PATTERN, '[e-mail]', $text);

        return (string) preg_replace(self::PHONE_PATTERN, '[telefone]', $text);
    }

    public static function isSensitiveKey(string $key): bool
    {
        $normalized = strtolower($key);

        if (in_array($normalized, self::ALLOWED_KEYS, true)) {
            return false;
        }

        if (in_array($normalized, self::SENSITIVE_EXACT_KEYS, true)) {
            return true;
        }

        foreach (self::SENSITIVE_KEY_PARTS as $part) {
            if (str_contains($normalized, $part)) {
                return true;
            }
        }

        return false;
    }
}
