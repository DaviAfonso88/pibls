<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\Monitoring\Healthchecks;
use App\Modules\Platform\Retention\RetentionPurger;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * `pibls:retention:purge` (diário, 04:00): expurgo de dados pessoais vencidos (BR-080, CAP-20). A auditoria guarda SÓ as
 * quantidades (`retention.purged`), nunca quem nem o quê. Sem nada a excluir, não grava auditoria.
 */
final class RetentionPurgeCommand extends Command
{
    protected $signature = 'pibls:retention:purge';

    protected $description = 'Exclui contatos, inscrições e falhas de fila que passaram do prazo de retenção';

    public function handle(RetentionPurger $purger, AuditLogger $audit, Healthchecks $healthchecks): int
    {
        try {
            $counts = $purger->purge(now());

            if (array_sum($counts) > 0) {
                $audit->record(AuditAction::RetentionPurged, changes: $counts, actorUserId: null);
            }

            $healthchecks->success('retention_purge');
            $this->info(sprintf(
                'Expurgo: %d contato(s), %d inscrição(ões), %d falha(s) de fila.',
                $counts['leads'],
                $counts['registrations'],
                $counts['failed_jobs'],
            ));

            return self::SUCCESS;
        } catch (Throwable $e) {
            report($e);
            Log::error('retention.purge_failed', ['reason' => $e->getMessage()]);
            $healthchecks->fail('retention_purge');
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }
}
