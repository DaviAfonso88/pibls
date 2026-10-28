<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Actions;

use App\Modules\Ministries\Enums\MinistryCategory;
use App\Modules\Ministries\Http\Resources\PublicMinistryResource;
use App\Modules\Ministries\Models\MinistryGroup;

/**
 * Ministérios, grupos e Células de CL ativos, na ordem de exibição e depois por nome (sem paginação).
 *
 * É a única fonte da lista pública: a API e o snapshot `ministries.json` passam por aqui e pelo mesmo Resource, então
 * os dois nunca divergem. O Resource escolhe os campos um a um; `private_address` e `contact_email` não entram
 * (BR-048).
 */
final class ListPublicMinistries
{
    /**
     * @return list<array<string, mixed>>
     */
    public function __invoke(?MinistryCategory $category = null, ?string $neighborhood = null): array
    {
        $items = MinistryGroup::query()
            ->where('is_active', true)
            ->when($category !== null, fn ($query) => $query->where('category', $category?->value))
            ->when($neighborhood !== null && $neighborhood !== '', fn ($query) => $query->where('neighborhood', $neighborhood))
            ->orderBy('display_order')
            ->orderBy('name')
            ->get();

        return array_values(PublicMinistryResource::collection($items)->resolve());
    }
}
