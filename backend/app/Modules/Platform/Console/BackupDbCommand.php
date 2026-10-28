<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Backup\BackupCipher;
use App\Modules\Platform\Backup\DatabaseDumper;
use App\Modules\Platform\Monitoring\Healthchecks;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * `pibls:backup:db` (de hora em hora): dump do banco, comprimido e cifrado com a chave PÚBLICA dos backups, em
 * `backups/db-AAAAMMDD-HHMMSS.sql.gz.enc`. Apaga os dumps locais com mais de 48 h (e só eles). O heartbeat vai ao
 * Healthchecks; sem chave pública o dump NÃO é gerado: nunca existe backup em texto claro (ADR-011).
 */
final class BackupDbCommand extends Command
{
    protected $signature = 'pibls:backup:db';

    protected $description = 'Dump cifrado do banco em backups/ (apaga os de mais de 48 h)';

    public function handle(DatabaseDumper $dumper, Healthchecks $healthchecks): int
    {
        if (! config('pibls.backup.enabled')) {
            $this->line('Backups desligados neste ambiente (BACKUPS_ENABLED=false).');

            return self::SUCCESS;
        }

        try {
            $publicKey = trim((string) config('pibls.backup.public_key'));
            if ($publicKey === '') {
                throw new RuntimeException('BACKUP_PUBLIC_KEY não está configurada: sem a chave pública o dump não é gerado, para nunca existir backup em texto claro. Gere o par com `php artisan pibls:backup:keygen`.');
            }

            $directory = (string) config('pibls.backup.path');
            File::ensureDirectoryExists($directory, 0750);

            $name = 'db-'.now('UTC')->format('Ymd-His').'.sql.gz.enc';
            $plain = $directory.'/.dump-'.bin2hex(random_bytes(4)).'.sql.gz.tmp';

            try {
                $dumper->dump($plain);
                BackupCipher::encryptFile($plain, $directory.'/'.$name, $publicKey);
            } finally {
                // O texto claro existe só durante o dump e nunca fica no disco
                if (is_file($plain)) {
                    unlink($plain);
                }
            }

            $removed = $this->pruneOld($directory);
            $healthchecks->success('backup_db');
            $this->info("Backup gravado: {$name}".($removed > 0 ? " ({$removed} antigo(s) apagado(s))" : ''));

            return self::SUCCESS;
        } catch (Throwable $e) {
            report($e);
            Log::error('backup.db_failed', ['reason' => $e->getMessage()]);
            $healthchecks->fail('backup_db');
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    /** Apaga os `db-*.sql.gz.enc` mais velhos que `pibls.backup.local_hours`. Nada mais na pasta é tocado. */
    private function pruneOld(string $directory): int
    {
        $limit = now()->subHours((int) config('pibls.backup.local_hours'))->getTimestamp();
        $removed = 0;

        foreach (glob($directory.'/db-*.sql.gz.enc') ?: [] as $file) {
            if (filemtime($file) < $limit && unlink($file)) {
                $removed++;
            }
        }

        return $removed;
    }
}
