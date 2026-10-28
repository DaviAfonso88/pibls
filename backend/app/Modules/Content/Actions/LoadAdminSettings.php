<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Content\Models\SiteSetting;
use App\Modules\Content\Settings\SettingSchemas;

/**
 * As configurações como o painel as vê: todas as chaves editáveis (a `pix` tem tela própria) com os valores
 * completos, inclusive `notification_recipients`, que nunca sai pela API pública (BR-050). Junto vão os avisos de
 * tipo de contato sem destinatário (BR-011), para a tela mostrar o banner.
 */
final class LoadAdminSettings
{
    /**
     * @return array{data: array<string, mixed>, warnings: list<array{code: string, lead_type: string, message: string}>}
     */
    public function __invoke(): array
    {
        $stored = SiteSetting::query()
            ->whereIn('key', SettingSchemas::KEYS)
            ->get()
            ->mapWithKeys(fn (SiteSetting $setting) => [$setting->key => $setting->value])
            ->all();

        $data = [];
        foreach (SettingSchemas::KEYS as $key) {
            if (array_key_exists($key, $stored)) {
                $data[$key] = $stored[$key];
            }
        }

        $recipients = is_array($data[SettingSchemas::PRIVATE_KEY] ?? null) ? $data[SettingSchemas::PRIVATE_KEY] : [];

        return [
            'data' => $data,
            'warnings' => array_map(
                fn (string $type) => [
                    'code' => 'NO_RECIPIENTS',
                    'lead_type' => $type,
                    'message' => str_replace('tipo X', 'tipo '.$type, __('business.BR-011')),
                ],
                SettingSchemas::typesWithoutRecipients($recipients),
            ),
        ];
    }
}
