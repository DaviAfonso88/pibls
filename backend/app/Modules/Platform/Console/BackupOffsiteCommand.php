<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Backup\OffsiteBackup;
use App\Modules\Platform\Monitoring\Healthchecks;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Throwable;

/**
 * `pibls:backup:offsite` (diário, 03:30 em São Paulo): envia ao B2 o dump mais recente (mais o mensal no dia 1) e os
 * uploads novos. Se o dump local mais novo tem mais de 26 h, o `pibls:backup:db` está parado: falha em vez de mandar uma
 * cópia velha como se fosse a de hoje. Falha final → `/fail` no Healthchecks (E-mail + push).
 */
final class BackupOffsiteCommand extends Command
{
    /** Um dump por hora, mais a folga de uma execução atrasada do cron. */
    private const MAX_DUMP_AGE_HOURS = 26;

    protected $signature = 'pibls:backup:offsite';

    protected $description = 'Envia ao B2 o dump do dia (e o mensal, no dia 1) e os uploads novos';

    public function handle(Healthchecks $healthchecks): int
    {
        if (! config('pibls.backup.enabled')) {
            $this->line('Backups desligados neste ambiente (BACKUPS_ENABLED=false).');

            return self::SUCCESS;
        }

        try {
            $dump = $this->latestDump((string) config('pibls.backup.path'));

            /** @var list<int> $backoff */
            $backoff = array_values(array_map('intval', (array) config('pibls.backup.offsite_backoff')));
            $copy = new OffsiteBackup(
                Storage::disk((string) config('pibls.backup.offsite_disk')),
                Storage::disk('uploads'),
                $backoff,
                static function (int $seconds): void {
                    if ($seconds > 0) {
                        sleep($seconds);
                    }
                },
            );

            $result = $copy->run($dump, now());
            $healthchecks->success('backup_offsite');
            $this->info("Cópia enviada: {$result['daily']}".($result['monthly'] !== null ? " e {$result['monthly']}" : '').", {$result['uploads']} upload(s) novo(s).");

            return self::SUCCESS;
        } catch (Throwable $e) {
            report($e);
            Log::error('backup.offsite_failed', ['reason' => $e->getMessage()]);
            $healthchecks->fail('backup_offsite');
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    private function latestDump(string $directory): string
    {
        $files = glob($directory.'/db-*.sql.gz.enc') ?: [];
        usort($files, static fn (string $a, string $b): int => filemtime($b) <=> filemtime($a));

        if ($files === []) {
            throw new RuntimeException('Nenhum dump local para enviar ao B2: o `pibls:backup:db` não gerou nenhum.');
        }

        $ageHours = (int) floor((now()->getTimestamp() - (int) filemtime($files[0])) / 3600);
        if ($ageHours > self::MAX_DUMP_AGE_HOURS) {
            throw new RuntimeException("O dump local mais recente tem {$ageHours} h (limite de ".self::MAX_DUMP_AGE_HOURS.' h): o `pibls:backup:db` está parado.');
        }

        return $files[0];
    }
}
