<?php

declare(strict_types=1);

namespace App\Modules\Platform\Console;

use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use Illuminate\Console\Command;
use Throwable;

/**
 * `pibls:release:activated <id> [--rolled-back]`: o ativador (`finalize.php`) o chama na release NOVA, logo depois de
 * trocar o ponteiro. Regenera os snapshots públicos e registra `release.activated` (ou `release.rolled_back`) na
 * auditoria. Falhar aqui nunca desfaz a ativação: o ativador só registra o aviso.
 */
final class ReleaseActivatedCommand extends Command
{
    protected $signature = 'pibls:release:activated {release_id : Id da release (AAAA.MM.N)} {--rolled-back : A ativação foi um rollback}';

    protected $description = 'Pós-ativação: regenera os snapshots e registra a ativação ou o rollback na auditoria';

    public function handle(SnapshotRegenerator $snapshots, AuditLogger $audit): int
    {
        $releaseId = (string) $this->argument('release_id');
        $rolledBack = $this->option('rolled-back') === true;
        $failed = false;

        $result = $snapshots->refresh();
        foreach ($result['written'] as $name) {
            $this->info("Snapshot {$name} regenerado.");
        }
        foreach ($result['failed'] as $name) {
            $failed = true;
            $this->error("Falha ao regenerar o snapshot {$name}.");
        }

        try {
            $audit->record(
                $rolledBack ? AuditAction::ReleaseRolledBack : AuditAction::ReleaseActivated,
                'release',
                $releaseId,
                actorUserId: null,
            );
            $this->info($rolledBack ? "Rollback para {$releaseId} registrado." : "Ativação de {$releaseId} registrada.");
        } catch (Throwable $e) {
            $failed = true;
            report($e);
            $this->error('Não foi possível registrar a ativação na auditoria.');
        }

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
