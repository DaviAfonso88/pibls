<?php

declare(strict_types=1);

namespace App\Modules\Content\Snapshots;

use App\Modules\Content\Actions\LoadHomeHighlights;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Platform\Snapshots\SnapshotDefinition;
use App\Modules\Platform\Snapshots\SnapshotSections;
use Carbon\CarbonInterface;

/**
 * `data/home.json` (contracts/snapshots.md): último boletim, últimas mensagens e próximos eventos (vazio na R1).
 * Um boletim ou mensagem agendado passa a valer sozinho, no horário: o agendador (a cada 5 min) pergunta aqui se algum
 * `published_at` caiu no intervalo desde a última verificação (BR-042).
 */
final class HomeSnapshot implements SnapshotDefinition
{
    public function __construct(
        private readonly LoadHomeHighlights $load,
        private readonly SnapshotSections $sections,
    ) {}

    public function name(): string
    {
        return 'home';
    }

    /** Os próximos eventos (`upcoming_events`) vêm da seção que o módulo de eventos registra, com a flag ligada. */
    public function build(): array
    {
        return $this->sections->apply($this->name(), ($this->load)());
    }

    public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
    {
        return Bulletin::query()->where('published_at', '>', $since)->where('published_at', '<=', $until)->exists()
            || PalavraVivaPost::query()->where('published_at', '>', $since)->where('published_at', '<=', $until)->exists()
            || $this->sections->hasScheduledChange($this->name(), $since, $until);
    }
}
