<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * `pibls:audit:prune` (mensal): exclui a auditoria com mais de 24 meses (`RETENTION_AUDIT_MONTHS`). A auditoria é só
 * inclusão: este é o único lugar que apaga linhas dela, e não deixa rastro próprio (seria uma linha nova por mês).
 */
final class AuditPruneCommand extends Command
{
    protected $signature = 'pibls:audit:prune';

    protected $description = 'Exclui os registros de auditoria mais antigos que o prazo de retenção';

    public function handle(): int
    {
        $cutoff = now()->subMonthsNoOverflow((int) config('pibls.retention.audit_months'));
        $deleted = DB::table('audit_logs')->where('occurred_at', '<', $cutoff)->delete();

        $this->info("Auditoria: {$deleted} registro(s) com mais de ".(int) config('pibls.retention.audit_months').' meses excluído(s).');

        return self::SUCCESS;
    }
}
