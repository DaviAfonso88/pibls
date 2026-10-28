<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Models\Lead;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * A lista de uma caixa (CAP-10 e CAP-11). A caixa geral nunca traz o pedido de oração, e a de oração só traz ele
 * (BR-007). O recorte é feito aqui, no banco, e a permissão da caixa é conferida antes, pelo controlador.
 */
final class ListLeads
{
    public const DEFAULT_PER_PAGE = 25;

    public const MAX_PER_PAGE = 100;

    /**
     * @param  LeadType|null  $type  só na caixa geral
     * @param  string|null  $from  data `AAAA-MM-DD` (início do dia em Brasília)
     * @param  string|null  $to  data `AAAA-MM-DD` (fim do dia em Brasília)
     * @return LengthAwarePaginator<int, Lead>
     */
    public function __invoke(
        bool $prayerInbox,
        ?LeadType $type = null,
        ?LeadStatus $status = null,
        ?int $assignedTo = null,
        ?string $from = null,
        ?string $to = null,
        ?string $search = null,
        bool $oldestFirst = false,
        bool $onlyOpen = false,
        bool $withoutAssignee = false,
        int $page = 1,
        int $perPage = self::DEFAULT_PER_PAGE,
    ): LengthAwarePaginator {
        $query = Lead::query()->with('assignee');

        $prayerInbox
            ? $query->where('type', LeadType::Oracao->value)
            : $query->where('type', '!=', LeadType::Oracao->value);

        $query
            ->when($type !== null && ! $prayerInbox, fn (Builder $q) => $q->where('type', $type?->value))
            ->when($status !== null, fn (Builder $q) => $q->where('status', $status?->value))
            ->when($onlyOpen, fn (Builder $q) => $q->whereIn('status', [LeadStatus::Novo->value, LeadStatus::EmAtendimento->value]))
            ->when($withoutAssignee, fn (Builder $q) => $q->whereNull('assigned_to'))
            ->when($assignedTo !== null, fn (Builder $q) => $q->where('assigned_to', $assignedTo))
            ->when($from !== null, fn (Builder $q) => $q->where('created_at', '>=', $this->dayBoundary((string) $from, false)))
            ->when($to !== null, fn (Builder $q) => $q->where('created_at', '<=', $this->dayBoundary((string) $to, true)))
            ->when($search !== null && mb_strlen(trim($search)) >= 2, fn (Builder $q) => $this->search($q, trim((string) $search)))
            ->orderBy('created_at', $oldestFirst ? 'asc' : 'desc')
            ->orderBy('id', $oldestFirst ? 'asc' : 'desc');

        return $query->paginate(perPage: min($perPage, self::MAX_PER_PAGE), page: $page);
    }

    /**
     * Nome (contém) ou telefone (só os dígitos, contém). A mensagem é cifrada e nunca entra na busca.
     *
     * @param  Builder<Lead>  $query
     */
    private function search(Builder $query, string $search): void
    {
        $like = '%'.addcslashes($search, '\\%_').'%';
        $digits = (string) preg_replace('/\D+/', '', $search);

        $query->where(function (Builder $inner) use ($like, $digits, $search): void {
            $inner->where('name', 'like', $like);

            // Telefone só quando o termo parece telefone (dígitos e pontuação): "Maria 31" não pode casar todo número com 31
            if (strlen($digits) >= 2 && preg_match('/^[\d\s().+\-]+$/', $search) === 1) {
                $inner->orWhere('phone', 'like', '%'.$digits.'%');
            }
        });
    }

    /** Início ou fim do dia, na data de Brasília, em UTC (é como o banco guarda). */
    private function dayBoundary(string $date, bool $endOfDay): string
    {
        $day = CarbonImmutable::parse($date, 'America/Sao_Paulo');
        $day = $endOfDay ? $day->endOfDay() : $day->startOfDay();

        return $day->utc()->toDateTimeString();
    }
}
