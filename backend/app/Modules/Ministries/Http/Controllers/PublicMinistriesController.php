<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Controllers;

use App\Modules\Ministries\Actions\ListPublicMinistries;
use App\Modules\Ministries\Http\Requests\ListPublicMinistriesRequest;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/public/ministries`: ministérios, grupos e células ativos, sem paginação. Nunca inclui
 * `private_address` nem `contact_email` (BR-048).
 */
final class PublicMinistriesController
{
    public function __invoke(ListPublicMinistriesRequest $request, ListPublicMinistries $list): JsonResponse
    {
        return response()
            ->json(['data' => $list($request->category(), $request->neighborhood())])
            ->header('Cache-Control', 'public, max-age=60');
    }
}
