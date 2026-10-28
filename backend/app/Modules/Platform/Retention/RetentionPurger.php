<?php

declare(strict_types=1);

namespace App\Modules\Platform\Retention;

use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Expurgo LGPD (BR-080, FR-065, data-model → Retenção e expurgo): exclusão DEFINITIVA do que passou do prazo, que vem de
 * `pibls.retention` (`RETENTION_*` no `.env`, aprovados pela liderança em 2026-10-23).
 *
 * `Platform` não conhece os módulos de negócio (teste de arquitetura): as tabelas são tratadas pelo nome. O histórico de
 * atendimento (`lead_activities`) sai em cascata pela FK. Nada pessoal é devolvido: só as quantidades.
 */
class RetentionPurger
{
    /**
     * @return array{leads: int, registrations: int, failed_jobs: int}
     */
    public function purge(CarbonInterface $now): array
    {
        return DB::transaction(fn (): array => [
            'leads' => $this->purgeLeads($now),
            'registrations' => $this->purgeRegistrations($now),
            'failed_jobs' => $this->purgeFailedJobs($now),
        ]);
    }

    private function purgeLeads(CarbonInterface $now): int
    {
        $oracaoDone = $now->copy()->subDays((int) config('pibls.retention.oracao_days'));
        $oracaoOpen = $now->copy()->subDays((int) config('pibls.retention.oracao_unfinished_days'));
        $others = $now->copy()->subMonthsNoOverflow((int) config('pibls.retention.leads_months'));

        // Oração concluída: prazo contado da conclusão. Oração nunca concluída: do envio.
        $deleted = DB::table('leads_messages')
            ->where('type', 'ORACAO')->where('status', 'CONCLUIDO')->where('status_changed_at', '<', $oracaoDone)
            ->delete();

        $deleted += DB::table('leads_messages')
            ->where('type', 'ORACAO')->where('status', '!=', 'CONCLUIDO')->where('created_at', '<', $oracaoOpen)
            ->delete();

        // Demais contatos: da última mudança de status; o que ficou parado em aberto por todo o prazo também sai
        $deleted += DB::table('leads_messages')
            ->where('type', '!=', 'ORACAO')->where('status_changed_at', '<', $others)
            ->delete();

        return $deleted;
    }

    private function purgeRegistrations(CarbonInterface $now): int
    {
        $cutoff = $now->copy()->subMonthsNoOverflow((int) config('pibls.retention.registrations_months'));

        return DB::table('event_registrations')
            ->whereIn('event_id', fn (Builder $events) => $events
                ->select('id')->from('events')
                // O fim do evento, ou o início se não houver fim
                ->whereRaw('COALESCE(ends_at, starts_at) < ?', [$cutoff]))
            ->delete();
    }

    private function purgeFailedJobs(CarbonInterface $now): int
    {
        return DB::table('failed_jobs')
            ->where('failed_at', '<', $now->copy()->subDays((int) config('pibls.retention.failed_jobs_days')))
            ->delete();
    }
}
