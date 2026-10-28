<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Access\Models\User;
use App\Modules\Content\Actions\LoadPixSettings;
use App\Modules\Content\Actions\UpdatePixSettings;
use App\Modules\Content\Http\Requests\UpdatePixSettingsRequest;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\JsonResponse;

/**
 * Os dados PIX no painel (CAP-18). A permissão `pix.write` é conferida na rota (`can:`) antes de ler o corpo (BR-076).
 */
final class PixSettingsController
{
    /** `GET /api/admin/settings/pix`: o valor vigente e as últimas alterações. */
    public function show(LoadPixSettings $load): JsonResponse
    {
        return response()->json($load());
    }

    /** `POST /api/admin/settings/pix` (multipart): altera com a reconfirmação de senha (BR-060 a BR-063, BR-045). */
    public function update(UpdatePixSettingsRequest $request, UpdatePixSettings $update, LoadPixSettings $load): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        /** @var array{pix_key: string, beneficiary_name: string, copy_paste_code?: string|null, current_password: string} $input */
        $input = $request->safe()->only(['pix_key', 'beneficiary_name', 'copy_paste_code', 'current_password']);

        $update($user, $input, $request->file('qr_image'));

        return response()->json(['data' => $load->current()]);
    }
}
