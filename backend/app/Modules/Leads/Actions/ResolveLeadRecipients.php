<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Content\Models\SiteSetting;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Ministries\Models\MinistryGroup;
use App\Shared\ValueObjects\EmailAddress;

/**
 * Quem recebe o aviso de um contato novo (CAP-05 → Roteamento da notificação; RF-D07):
 *
 *  - `MINISTERIO`: o e-mail de contato interno do ministério escolhido; sem ele, a lista configurada para o tipo;
 *  - demais tipos: a lista configurada para o tipo (`notification_recipients`, em `/admin/configuracoes`).
 *
 * E-mail inválido ou repetido é descartado. Lista vazia devolve `[]`: o contato continua gravado e o chamador registra
 * o aviso (BR-011).
 */
final class ResolveLeadRecipients
{
    /**
     * @return list<string>
     */
    public function __invoke(LeadType $type, ?int $ministryId = null): array
    {
        if ($type === LeadType::Ministerio && $ministryId !== null) {
            $contact = MinistryGroup::query()->whereKey($ministryId)->value('contact_email');
            $address = is_string($contact) ? EmailAddress::tryFrom($contact) : null;

            if ($address !== null) {
                return [$address->value()];
            }
        }

        return $this->configuredList($type);
    }

    /**
     * @return list<string>
     */
    private function configuredList(LeadType $type): array
    {
        $setting = SiteSetting::query()->where('key', 'notification_recipients')->first();
        $lists = $setting === null ? [] : $setting->value;
        $configured = is_array($lists[$type->value] ?? null) ? $lists[$type->value] : [];

        $addresses = [];
        foreach ($configured as $candidate) {
            $address = is_string($candidate) ? EmailAddress::tryFrom($candidate) : null;
            if ($address !== null) {
                $addresses[$address->value()] = true;
            }
        }

        return array_keys($addresses);
    }
}
