<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Http\Resources\PublicSettingsResource;
use App\Modules\Content\Models\SiteSetting;

/**
 * As configurações públicas serializadas (`PublicSettings`). A API (`GET /api/public/settings`) e o snapshot
 * `settings.json` usam esta mesma Action e o mesmo Resource: o teste de contrato garante que os dois são iguais.
 */
final class LoadPublicSettings
{
    /**
     * @return array<string, mixed>
     */
    public function __invoke(): array
    {
        $values = SiteSetting::query()
            ->where('is_public', true)
            ->get()
            ->mapWithKeys(fn (SiteSetting $setting) => [$setting->key => $setting->value])
            ->all();

        return (new PublicSettingsResource($values))->resolve();
    }
}
