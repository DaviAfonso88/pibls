<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Content\Actions\LoadAdminSettings;
use App\Modules\Content\Actions\UpdateSettings;
use App\Modules\Content\Http\Requests\UpdateSettingsRequest;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;

/**
 * As configurações institucionais no painel (CAP-17). A permissão `settings.write` é conferida na rota (`can:`), antes de
 * qualquer corpo ser lido (BR-076).
 */
final class AdminSettingsController
{
    /** `GET /api/admin/settings`: todas as chaves, menos a `pix`, e os avisos de tipo sem destinatário (BR-011). */
    public function show(LoadAdminSettings $load): JsonResponse
    {
        return response()->json($load());
    }

    /** `PATCH /api/admin/settings`: substitui as chaves enviadas (BR-051) e devolve o conjunto atualizado. */
    public function update(UpdateSettingsRequest $request, UpdateSettings $update, LoadAdminSettings $load): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $update($request->changes(), $user);

        return response()->json($load());
    }
}
