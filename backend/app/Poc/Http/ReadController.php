<?php

declare(strict_types=1);

namespace App\Poc\Http;

use App\Poc\Models\PocMinistryGroup;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * PoC F0-03 (T013): leitura típica do projeto (Eloquent + join + Resource, no grupo `api`).
 * REMOVER na T015.
 */
final class ReadController
{
    public function __invoke(): AnonymousResourceCollection
    {
        $groups = PocMinistryGroup::query()
            ->join('poc_categories', 'poc_categories.id', '=', 'poc_ministry_groups.category_id')
            ->where('poc_ministry_groups.is_active', true)
            ->orderBy('poc_categories.display_order')
            ->orderBy('poc_ministry_groups.display_order')
            ->limit(50)
            ->get([
                'poc_ministry_groups.id',
                'poc_ministry_groups.name',
                'poc_ministry_groups.neighborhood',
                'poc_categories.slug as category',
            ]);

        return GroupResource::collection($groups);
    }
}
