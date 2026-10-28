<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Content\Actions\ListPublicBulletins;
use App\Modules\Content\Http\Requests\ListPublicBulletinsRequest;
use App\Modules\Content\Http\Resources\BulletinPublicResource;
use App\Shared\Http\PageMeta;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/public/bulletins`: os boletins publicados, 12 por página, com filtro de ano e mês. Boletim agendado ou
 * excluído não aparece (BR-042). Os dados vêm do banco; só o último boletim também vai para o snapshot da home.
 */
final class PublicBulletinsController
{
    public function __invoke(ListPublicBulletinsRequest $request, ListPublicBulletins $list): JsonResponse
    {
        $bulletins = $list(
            year: $request->filled('year') ? $request->integer('year') : null,
            month: $request->filled('month') ? $request->integer('month') : null,
            page: $request->integer('page', 1),
        );

        return response()
            ->json([
                'data' => BulletinPublicResource::collection($bulletins->items())->resolve($request),
                'meta' => PageMeta::of($bulletins),
            ])
            ->header('Cache-Control', 'public, max-age=60');
    }
}
