<?php

declare(strict_types=1);

namespace App\Modules\Platform\Doctor;

use Illuminate\Support\Facades\DB;

/**
 * Tudo que o `pibls:doctor` pergunta ao PHP e ao sistema de arquivos, num só lugar. Existe para os testes poderem
 * simular um servidor com extensão faltando, `memory_limit` baixo ou disco cheio sem mexer no ambiente de verdade.
 */
class SystemProbe
{
    public function phpVersion(): string
    {
        return PHP_VERSION;
    }

    public function extensionLoaded(string $extension): bool
    {
        return extension_loaded($extension);
    }

    public function iniValue(string $key): ?string
    {
        $value = ini_get($key);

        return $value === false ? null : $value;
    }

    /** Há suporte a WebP no GD? (banners dos eventos). */
    public function gdSupportsWebp(): bool
    {
        if (! function_exists('gd_info')) {
            return false;
        }

        return (gd_info()['WebP Support'] ?? false) === true;
    }

    public function opcacheEnabled(): bool
    {
        return function_exists('opcache_get_status') && ini_get('opcache.enable') === '1';
    }

    /** A pasta existe (ou pode ser criada) e aceita escrita? */
    public function canWriteTo(string $directory): bool
    {
        if (! is_dir($directory) && ! @mkdir($directory, 0755, true) && ! is_dir($directory)) {
            return false;
        }

        // Escreve de verdade: `is_writable` mente em alguns sistemas de arquivos de hospedagem
        $probe = rtrim($directory, '/\\').'/.doctor-'.bin2hex(random_bytes(4));
        $written = @file_put_contents($probe, 'ok') !== false;
        @unlink($probe);

        return $written;
    }

    /** Resposta de `SELECT VERSION()` na conexão padrão (lança exceção se o banco não responde). */
    public function databaseVersion(): string
    {
        $row = DB::selectOne('SELECT VERSION() AS version');

        return is_object($row) && isset($row->version) && is_string($row->version) ? $row->version : '';
    }

    public function freeDiskBytes(string $path): ?int
    {
        $free = @disk_free_space($path);

        return $free === false ? null : (int) $free;
    }
}
