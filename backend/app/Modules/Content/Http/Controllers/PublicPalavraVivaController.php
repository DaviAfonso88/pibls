<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Content\Actions\FindPublishedPalavraViva;
use App\Modules\Content\Actions\ListPublicPalavraViva;
use App\Modules\Content\Http\Requests\PageRequest;
use App\Modules\Content\Http\Resources\PalavraVivaDetailResource;
use App\Modules\Content\Http\Resources\PalavraVivaSummaryResource;
use App\Shared\Http\PageMeta;
use Illuminate\Http\JsonResponse;

/**
 * A Palavra Viva pública: a lista (`excerpt` no lugar do corpo) e a mensagem pelo endereço. Mensagem agendada, excluída
 * ou inexistente dá 404 (BR-042).
 */
final class PublicPalavraVivaController
{
    public function index(PageRequest $request, ListPublicPalavraViva $list): JsonResponse
    {
        $posts = $list($request->integer('page', 1));

        return response()
            ->json([
                'data' => PalavraVivaSummaryResource::collection($posts->items())->resolve($request),
                'meta' => PageMeta::of($posts),
            ])
            ->header('Cache-Control', 'public, max-age=60');
    }

    public function show(string $slug, FindPublishedPalavraViva $find): JsonResponse
    {
        return response()
            ->json(['data' => (new PalavraVivaDetailResource($find($slug)))->resolve()])
            ->header('Cache-Control', 'public, max-age=60');
    }
}
