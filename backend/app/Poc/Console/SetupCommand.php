<?php

declare(strict_types=1);

namespace App\Poc\Console;

use App\Poc\PocData;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * PoC F0-03 (T013): prepara (ou remove) as tabelas e os dados da PoC.
 * Existe porque a conta não tem SSH: roda como tarefa única do cron. REMOVER na T015.
 */
final class SetupCommand extends Command
{
    protected $signature = 'poc:setup {--rows=200 : Quantidade de grupos} {--drop : Remove as tabelas da PoC}';

    protected $description = 'PoC F0-03: cria e popula as tabelas da PoC de desempenho';

    public function handle(): int
    {
        if ($this->option('drop')) {
            Schema::dropIfExists('poc_ministry_groups');
            Schema::dropIfExists('poc_categories');
            DB::table('migrations')->where('migration', 'like', '%create_poc_tables')->delete();
            $this->components->info('Tabelas da PoC removidas.');

            return self::SUCCESS;
        }

        $this->call('migrate', ['--force' => true]);

        $rows = max(1, (int) $this->option('rows'));
        PocData::seed($rows);
        $this->components->info("PoC pronta: {$rows} grupos em 8 categorias.");

        return self::SUCCESS;
    }
}
