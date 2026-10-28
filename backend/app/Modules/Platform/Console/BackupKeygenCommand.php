<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Backup\BackupCipher;
use Illuminate\Console\Command;

/**
 * `pibls:backup:keygen`: gera o par de chaves dos backups. Rode na máquina do responsável, NUNCA no servidor. A pública vai
 * para o `.env` do servidor (`BACKUP_PUBLIC_KEY`); a privada vai para o KeePassXC do kit de contingência: sem ela os
 * backups não abrem, e quem a tem abre todos.
 */
final class BackupKeygenCommand extends Command
{
    protected $signature = 'pibls:backup:keygen';

    protected $description = 'Gera o par de chaves dos backups (rode na sua máquina, não no servidor)';

    public function handle(): int
    {
        [$public, $secret] = BackupCipher::generateKeypair();

        $this->line("BACKUP_PUBLIC_KEY={$public}");
        $this->line("BACKUP_PRIVATE_KEY={$secret}");
        $this->newLine();
        $this->warn('A pública vai para o .env do servidor. A PRIVADA fica só no KeePassXC (kit de contingência): nunca no servidor, no repositório nem em conversa.');

        return self::SUCCESS;
    }
}
