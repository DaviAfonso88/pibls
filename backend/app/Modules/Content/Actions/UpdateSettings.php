<?php

declare(strict_types=1);

namespace App\Modules\Content\Actions;

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\SiteSetting;
use App\Modules\Content\Settings\SettingSchemas;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Illuminate\Support\Facades\DB;

/**
 * Substitui as chaves enviadas (cada uma com o valor completo; as outras não mudam). Uma chave pública alterada
 * regenera o snapshot `settings.json` depois do commit; só os destinatários de e-mail (privados) não regeneram nada.
 * A auditoria guarda quais chaves mudaram e, para os destinatários, só a contagem por tipo: os endereços são dado
 * pessoal e não vão para o log.
 */
final class UpdateSettings
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * @param  array<string, mixed>  $changes  chave => valor já normalizado por `SettingSchemas::normalize()`
     * @return list<string> as chaves que de fato mudaram
     */
    public function __invoke(array $changes, User $actor): array
    {
        return DB::transaction(function () use ($changes, $actor): array {
            $changed = [];

            foreach ($changes as $key => $value) {
                $setting = SiteSetting::query()->whereKey($key)->lockForUpdate()->first()
                    ?? (new SiteSetting)->forceFill(['key' => $key, 'is_public' => $key !== SettingSchemas::PRIVATE_KEY]);

                if ($setting->exists && $setting->value == $value) {
                    continue;
                }

                $setting->value = $value;
                $setting->updated_by = $actor->getKey();
                $setting->save();

                $changed[] = (string) $key;
            }

            if ($changed === []) {
                return [];
            }

            $details = ['fields' => $changed];
            if (in_array(SettingSchemas::PRIVATE_KEY, $changed, true)) {
                $details['recipient_counts'] = array_map(
                    fn (array $list) => count($list),
                    $changes[SettingSchemas::PRIVATE_KEY],
                );
            }
            $this->audit->record(AuditAction::SettingUpdated, 'setting', implode(',', $changed), $details);

            if (array_diff($changed, [SettingSchemas::PRIVATE_KEY]) !== []) {
                event(new PublicContentChanged(['settings']));
            }

            return $changed;
        });
    }
}
