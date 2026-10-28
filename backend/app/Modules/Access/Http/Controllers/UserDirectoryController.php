<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Controllers;

use App\Modules\Access\Actions\ListUsers;
use App\Modules\Access\Http\Requests\ListUsersRequest;
use App\Modules\Access\Http\Resources\UserDirectoryResource;
use App\Shared\Http\PageMeta;
use Illuminate\Http\JsonResponse;

/** `GET /api/admin/users` (`users.read`): diretório somente leitura (BG-4). Não existe rota de escrita (BR-077). */
final class UserDirectoryController
{
    public function __invoke(ListUsersRequest $request, ListUsers $list): JsonResponse
    {
        $users = $list(
            isActive: $request->filled('is_active') ? $request->boolean('is_active') : null,
            ministryId: $request->integer('ministry_id') ?: null,
            descending: $request->input('sort') === '-name',
            page: $request->integer('page', 1),
            perPage: $request->integer('per_page', ListUsers::DEFAULT_PER_PAGE),
        );

        return response()->json([
            'data' => UserDirectoryResource::collection($users->items())->resolve($request),
            'meta' => PageMeta::of($users),
        ]);
    }
}
