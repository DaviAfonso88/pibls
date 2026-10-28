<?php

declare(strict_types=1);

namespace App\Modules\Platform\Backup;

use InvalidArgumentException;
use RuntimeException;
use Throwable;

/**
 * Envelope de cifragem dos backups (architecture.md → Security → Criptografia; ADR-011).
 *
 * Cada arquivo tem uma chave simétrica aleatória própria, usada com `crypto_secretstream_xchacha20poly1305` (blocos de
 * 64 KiB, autenticados: qualquer byte alterado ou cortado é recusado) e selada com a CHAVE PÚBLICA dos backups
 * (`crypto_box_seal`). Só quem tem a chave privada, que nunca fica no servidor, abre o arquivo.
 *
 * Formato: `PIBLSBK1` · chave selada (80 bytes) · cabeçalho do secretstream (24 bytes) · blocos (até 64 KiB + 17 bytes
 * cada; o último leva a marca FINAL).
 */
final class BackupCipher
{
    private const MAGIC = 'PIBLSBK1';

    private const CHUNK = 65_536;

    public static function encryptFile(string $source, string $destination, string $publicKey): void
    {
        $public = self::decodeKey($publicKey, SODIUM_CRYPTO_BOX_PUBLICKEYBYTES, 'pública');
        $in = self::open($source, 'rb');
        $tmp = $destination.'.tmp';
        $out = null;

        try {
            $out = self::open($tmp, 'wb');
            $key = sodium_crypto_secretstream_xchacha20poly1305_keygen();
            [$state, $header] = sodium_crypto_secretstream_xchacha20poly1305_init_push($key);
            self::write($out, self::MAGIC.sodium_crypto_box_seal($key, $public).$header);
            sodium_memzero($key);

            // Lê um bloco à frente para saber qual é o último (o único com a marca FINAL)
            $current = (string) fread($in, self::CHUNK);
            do {
                $next = (string) fread($in, self::CHUNK);
                $isLast = $next === '';
                self::write($out, sodium_crypto_secretstream_xchacha20poly1305_push(
                    $state,
                    $current,
                    '',
                    $isLast ? SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL : SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE,
                ));
                $current = $next;
            } while (! $isLast);

            fclose($out);
            fclose($in);
            self::replace($tmp, $destination);
        } catch (Throwable $e) {
            self::discard($in, $out, $tmp);
            throw $e;
        }
    }

    /**
     * @param  string  $secretKey  chave privada em base64, a que o `pibls:backup:keygen` imprimiu
     */
    public static function decryptFile(string $source, string $destination, string $secretKey): void
    {
        $secret = self::decodeKey($secretKey, SODIUM_CRYPTO_BOX_SECRETKEYBYTES, 'privada');
        $keypair = sodium_crypto_box_keypair_from_secretkey_and_publickey($secret, sodium_crypto_box_publickey_from_secretkey($secret));
        sodium_memzero($secret);

        $in = self::open($source, 'rb');
        $tmp = $destination.'.tmp';
        $out = null;

        try {
            $magicLength = strlen(self::MAGIC);
            $sealedLength = SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_KEYBYTES + SODIUM_CRYPTO_BOX_SEALBYTES;
            $headerLength = SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES;
            $preamble = (string) fread($in, $magicLength + $sealedLength + $headerLength);

            if (strlen($preamble) !== $magicLength + $sealedLength + $headerLength || ! str_starts_with($preamble, self::MAGIC)) {
                throw new RuntimeException('O arquivo não é um backup do portal (formato desconhecido ou incompleto).');
            }

            $key = sodium_crypto_box_seal_open(substr($preamble, $magicLength, $sealedLength), $keypair);
            sodium_memzero($keypair);
            if ($key === false) {
                throw new RuntimeException('A chave privada não abre este backup.');
            }

            $state = sodium_crypto_secretstream_xchacha20poly1305_init_pull(substr($preamble, $magicLength + $sealedLength), $key);
            sodium_memzero($key);

            $out = self::open($tmp, 'wb');
            $block = self::CHUNK + SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_ABYTES;
            $current = (string) fread($in, $block);

            do {
                $next = (string) fread($in, $block);
                $isLast = $next === '';
                $result = sodium_crypto_secretstream_xchacha20poly1305_pull($state, $current);
                if ($result === false) {
                    throw new RuntimeException('Backup corrompido ou adulterado: um bloco não passou na verificação.');
                }
                [$plain, $tag] = $result;
                // O fim do arquivo e a marca FINAL têm de coincidir: senão o arquivo foi cortado ou tem lixo no fim
                if ($isLast !== ($tag === SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL)) {
                    throw new RuntimeException('Backup incompleto: o arquivo termina antes ou depois da marca final.');
                }
                self::write($out, $plain);
                $current = $next;
            } while (! $isLast);

            fclose($out);
            fclose($in);
            self::replace($tmp, $destination);
        } catch (Throwable $e) {
            self::discard($in, $out, $tmp);
            throw $e;
        }
    }

    /**
     * Um par de chaves novo, em base64.
     *
     * @return array{0: string, 1: string} `[pública, privada]`
     */
    public static function generateKeypair(): array
    {
        $pair = sodium_crypto_box_keypair();

        return [base64_encode(sodium_crypto_box_publickey($pair)), base64_encode(sodium_crypto_box_secretkey($pair))];
    }

    private static function decodeKey(string $encoded, int $length, string $kind): string
    {
        $key = base64_decode(trim($encoded), true);
        if ($key === false || strlen($key) !== $length) {
            throw new InvalidArgumentException("A chave {$kind} dos backups é inválida: precisa ter {$length} bytes, em base64 (gere o par com `php artisan pibls:backup:keygen`).");
        }

        return $key;
    }

    /** @return resource */
    private static function open(string $path, string $mode)
    {
        $handle = @fopen($path, $mode);
        if ($handle === false) {
            throw new RuntimeException("Não foi possível abrir {$path}.");
        }

        return $handle;
    }

    /** @param  resource  $handle */
    private static function write($handle, string $data): void
    {
        if (fwrite($handle, $data) !== strlen($data)) {
            throw new RuntimeException('Falha ao gravar o backup (disco cheio?).');
        }
    }

    private static function replace(string $tmp, string $destination): void
    {
        if (! rename($tmp, $destination)) {
            throw new RuntimeException("Não foi possível gravar {$destination}.");
        }
    }

    /**
     * @param  resource  $in
     * @param  resource|null  $out
     */
    private static function discard($in, $out, string $tmp): void
    {
        if (is_resource($in)) {
            fclose($in);
        }
        if (is_resource($out)) {
            fclose($out);
        }
        if (is_file($tmp)) {
            unlink($tmp);
        }
    }
}
