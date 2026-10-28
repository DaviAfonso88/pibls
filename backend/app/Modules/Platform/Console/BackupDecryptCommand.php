<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Backup\BackupCipher;
use Illuminate\Console\Command;
use Throwable;

/**
 * `pibls:backup:decrypt <arquivo.sql.gz.enc>`: abre um backup para a restauração (runbook `restaurar-backup.md`). Rode na
 * máquina que tem a chave privada, nunca no servidor. A chave vem de `--key-file` (melhor: não fica no histórico do
 * terminal), de `--key` ou é perguntada. Grava o `.sql.gz`; depois: `gunzip -c arquivo.sql.gz | mysql <banco>`.
 */
final class BackupDecryptCommand extends Command
{
    protected $signature = 'pibls:backup:decrypt
        {file : Backup cifrado (.sql.gz.enc), baixado do B2 ou da pasta backups/}
        {--key-file= : Arquivo de texto com a chave privada em base64}
        {--key= : A chave privada em base64 (prefira --key-file)}
        {--output= : Onde gravar o .sql.gz (padrão: ao lado, sem o .enc)}';

    protected $description = 'Abre um backup cifrado com a chave privada (para restaurar)';

    public function handle(): int
    {
        $source = (string) $this->argument('file');
        $output = (string) ($this->option('output') ?: preg_replace('/\.enc$/', '', $source));

        if ($output === $source) {
            $this->error('Informe --output: o arquivo de entrada não termina em .enc.');

            return self::FAILURE;
        }

        try {
            BackupCipher::decryptFile($source, $output, $this->secretKey());
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->info("Backup aberto em {$output}");
        $this->line("Para restaurar: gunzip -c {$output} | mysql <banco>");

        return self::SUCCESS;
    }

    private function secretKey(): string
    {
        $file = (string) $this->option('key-file');
        if ($file !== '') {
            return trim((string) @file_get_contents($file));
        }

        $key = (string) $this->option('key');

        return $key !== '' ? $key : (string) $this->secret('Chave privada dos backups (base64)');
    }
}
