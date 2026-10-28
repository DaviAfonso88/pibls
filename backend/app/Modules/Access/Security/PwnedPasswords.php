<?php

declare(strict_types=1);

namespace App\Modules\Access\Security;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Consulta à base de senhas vazadas Have I Been Pwned (I-05; BR-073). Usa a API de intervalo com k-anonimato: só os 5
 * primeiros caracteres do SHA-1 saem do servidor, nunca a senha nem o hash inteiro.
 *
 * *Fail-open*: se a API estiver fora do ar, lenta ou responder estranho, a senha passa e o aviso `password.hibp_unavailable`
 * vai para o log. A troca de senha nunca fica refém de um serviço de terceiros.
 */
final class PwnedPasswords
{
    private const ENDPOINT = 'https://api.pwnedpasswords.com/range/';

    private const TIMEOUT_SECONDS = 3;

    public function appearsInBreach(string $password): bool
    {
        if (! config('pibls.hibp_enabled')) {
            return false;
        }

        $sha1 = strtoupper(sha1($password));
        $prefix = substr($sha1, 0, 5);
        $suffix = substr($sha1, 5);

        try {
            $response = Http::timeout(self::TIMEOUT_SECONDS)
                ->withHeaders(['Add-Padding' => 'true', 'User-Agent' => 'pibls-portal'])
                ->get(self::ENDPOINT.$prefix);

            if (! $response->successful()) {
                Log::warning('password.hibp_unavailable', ['status' => $response->status()]);

                return false;
            }

            foreach (explode("\n", $response->body()) as $line) {
                [$candidate, $count] = array_pad(explode(':', trim($line), 2), 2, '0');

                // O padding devolve linhas falsas com contagem 0: não são vazamentos
                if (strcasecmp($candidate, $suffix) === 0 && (int) $count > 0) {
                    return true;
                }
            }

            return false;
        } catch (Throwable $e) {
            Log::warning('password.hibp_unavailable', ['reason' => $e::class]);

            return false;
        }
    }
}
