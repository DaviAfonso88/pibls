<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\SiteSetting;
use App\Modules\Platform\Models\AuditLog;

/**
 * Os dados PIX como a tela do painel os mostra (CAP-18): o valor vigente no mesmo formato público (`Pix`) e as últimas
 * alterações da auditoria (quem, quando e quais campos), sem os valores antigos.
 */
final class LoadPixSettings
{
    public const HISTORY_LIMIT = 10;

    /**
     * @return array{data: array{pix_key: string, beneficiary_name: string, qr_image_url: string|null, copy_paste_code: string|null}, history: list<array{id: int, occurred_at: string, actor: array{id: int, name: string}|null, fields: list<string>}>}
     */
    public function __invoke(): array
    {
        return ['data' => $this->current(), 'history' => $this->history()];
    }

    /**
     * @return array{pix_key: string, beneficiary_name: string, qr_image_url: string|null, copy_paste_code: string|null}
     */
    public function current(): array
    {
        $setting = SiteSetting::query()->find('pix');
        $value = $setting === null ? [] : $setting->value;
        $path = $value['qr_image_path'] ?? null;

        return [
            'pix_key' => (string) ($value['pix_key'] ?? ''),
            'beneficiary_name' => (string) ($value['beneficiary_name'] ?? ''),
            'qr_image_url' => is_string($path) && $path !== '' ? '/uploads/'.ltrim($path, '/') : null,
            'copy_paste_code' => isset($value['copy_paste_code']) && $value['copy_paste_code'] !== '' ? (string) $value['copy_paste_code'] : null,
        ];
    }

    /**
     * @return list<array{id: int, occurred_at: string, actor: array{id: int, name: string}|null, fields: list<string>}>
     */
    private function history(): array
    {
        $logs = AuditLog::query()
            ->where('action', 'pix.updated')
            ->orderByDesc('id')
            ->limit(self::HISTORY_LIMIT)
            ->get();

        $actors = User::query()
            ->whereIn('id', $logs->pluck('actor_user_id')->filter()->unique()->all())
            ->get(['id', 'name'])
            ->keyBy('id');

        return $logs->map(function (AuditLog $log) use ($actors): array {
            $actor = $log->actor_user_id === null ? null : $actors->get($log->actor_user_id);
            $fields = $log->changes['fields'] ?? [];

            return [
                'id' => (int) $log->getKey(),
                'occurred_at' => $log->occurred_at->utc()->format('Y-m-d\TH:i:s\Z'),
                'actor' => $actor === null ? null : ['id' => (int) $actor->getKey(), 'name' => $actor->name],
                'fields' => array_values(array_filter((array) $fields, 'is_string')),
            ];
        })->all();
    }
}
