<?php

declare(strict_types=1);

namespace App\Modules\Events\Http\Controllers;

use App\Modules\Events\Actions\ListPublicEvents;
use App\Modules\Events\Actions\ShowPublicEvent;
use App\Modules\Events\Http\Requests\ListPublicEventsRequest;
use App\Modules\Events\Http\Resources\EventDetailResource;
use App\Modules\Events\Http\Resources\EventSummaryResource;
use App\Shared\Http\PageMeta;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/public/events` e `GET /api/public/events/{slug}` (R2, atrás de `feature:events`). Dado público só: o
 * ministério vai como `{id, name}` (BR-048, BR-050). As vagas mudam a cada inscrição, então a resposta não fica em
 * cache: a página consulta de novo a cada 30 s.
 */
final class PublicEventsController
{
    public function index(ListPublicEventsRequest $request, ListPublicEvents $list): JsonResponse
    {
        $events = $list($request->boolean('include_past'), $request->integer('page', 1));

        return response()
            ->json([
                'data' => EventSummaryResource::collection($events->items())->resolve($request),
                'meta' => PageMeta::of($events),
            ])
            ->header('Cache-Control', 'no-cache');
    }

    public function show(string $slug, ShowPublicEvent $show): JsonResponse
    {
        $event = $show($slug);

        return response()
            ->json(['data' => (new EventDetailResource($event))->resolve()])
            ->header('Cache-Control', 'no-cache');
    }
}
