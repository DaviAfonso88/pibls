<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Actions;

use App\Modules\Ministries\Enums\MinistryCategory;
use App\Modules\Ministries\Http\Resources\MinistryAdminResource;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * O catálogo como o painel o vê (CAP-16): todos os itens, ativos ou não, com `private_address` e `contact_email`, que
 * só existem aqui (BR-048). Sem paginação: o catálogo tem até uns cem itens.
 */
final class ListAdminMinistries
{
    /**
     * @return list<array<string, mixed>>
     */
    public function __invoke(?MinistryCategory $category = null, ?bool $isActive = null, ?string $search = null): array
    {
        $term = $search === null ? '' : trim($search);

        $items = MinistryGroup::query()
            ->when($category !== null, fn ($query) => $query->where('category', $category?->value))
            ->when($isActive !== null, fn ($query) => $query->where('is_active', $isActive))
            ->when($term !== '', fn ($query) => $query->where('name', 'like', '%'.addcslashes($term, '%_\\').'%'))
            ->orderBy('display_order')
            ->orderBy('name')
            ->get();

        return $this->present($items);
    }

    /**
     * @param  Collection<int, MinistryGroup>  $items
     * @return list<array<string, mixed>>
     */
    public function present(Collection $items): array
    {
        $names = $this->updaterNames($items);

        return array_values($items->map(
            fn (MinistryGroup $item) => (new MinistryAdminResource($item, $names[$item->updated_by] ?? null))->resolve(),
        )->all());
    }

    /**
     * Quem alterou por último. A Ministries não depende do módulo de acessos, então o nome vem da tabela direto.
     *
     * @param  Collection<int, MinistryGroup>  $items
     * @return array<int, string>
     */
    private function updaterNames(Collection $items): array
    {
        $ids = $items->pluck('updated_by')->filter()->unique()->values()->all();

        if ($ids === []) {
            return [];
        }

        return DB::table('users')->whereIn('id', $ids)->pluck('name', 'id')->map(fn ($name) => (string) $name)->all();
    }
}
