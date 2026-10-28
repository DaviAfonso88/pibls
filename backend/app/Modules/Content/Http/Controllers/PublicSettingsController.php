<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers;

use App\Modules\Content\Actions\LoadPublicSettings;
use Illuminate\Http\JsonResponse;

/**
 * `GET /api/public/settings`: só as chaves públicas (BR-050) mais as feature flags. Mesmo formato de
 * `data/settings.json`; a SPA só vem aqui se o arquivo estático falhar.
 */
final class PublicSettingsController
{
    public function __invoke(LoadPublicSettings $load): JsonResponse
    {
        return response()
            ->json(['data' => $load()])
            ->header('Cache-Control', 'public, max-age=60');
    }
}
