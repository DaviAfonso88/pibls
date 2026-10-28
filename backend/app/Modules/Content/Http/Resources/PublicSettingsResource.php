<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * `PublicSettings` (contracts/openapi.yaml), a partir das configurações marcadas como públicas (`key => value`).
 * Lista branca de chaves (BR-050): `notification_recipients` e qualquer chave futura só saem daqui se alguém a
 * incluir de propósito. O caminho interno do QR Code vira URL pública.
 *
 * `features` vem do `.env` (`FEATURE_EVENTS`), não do banco.
 */
final class PublicSettingsResource extends JsonResource
{
    /** @var list<string> */
    private const PUBLIC_KEYS = [
        'schedule', 'campaign_notice', 'lords_supper_notice', 'address', 'map_links', 'whatsapp', 'youtube_links',
        'social_links',
    ];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var array<string, mixed> $settings */
        $settings = (array) $this->resource;

        $data = [];
        foreach (self::PUBLIC_KEYS as $key) {
            if (array_key_exists($key, $settings)) {
                $data[$key] = $settings[$key];
            }
        }

        if (isset($settings['pix']) && is_array($settings['pix'])) {
            $pix = $settings['pix'];
            $path = $pix['qr_image_path'] ?? null;

            $data['pix'] = [
                'pix_key' => $pix['pix_key'] ?? null,
                'beneficiary_name' => $pix['beneficiary_name'] ?? null,
                'qr_image_url' => is_string($path) && $path !== '' ? '/uploads/'.ltrim($path, '/') : null,
                'copy_paste_code' => $pix['copy_paste_code'] ?? null,
            ];
        }

        $data['features'] = ['events' => (bool) config('features.events')];

        return $data;
    }
}
