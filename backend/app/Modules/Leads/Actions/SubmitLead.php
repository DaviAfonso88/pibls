<?php

declare(strict_types=1);

namespace App\Modules\Leads\Actions;

use App\Modules\Leads\Enums\LeadStatus;
use App\Modules\Leads\Enums\LeadType;
use App\Modules\Leads\Events\LeadReceived;
use App\Modules\Leads\Models\Lead;
use App\Shared\ValueObjects\Consent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Registra um contato dos formulários públicos (CAP-05, passo 5). Numa única transação grava o contato como `NOVO`, com
 * o consentimento (BR-001) e a versão vigente da política (BR-082), e emite `LeadReceived`, cujo listener enfileira os
 * avisos. Se qualquer passo falhar, nada fica gravado. E-mail nunca é enviado aqui: a falha do SMTP não desfaz o
 * contato (FR-019).
 */
final class SubmitLead
{
    /**
     * @param  array<string, mixed>  $data  campos do tipo, já validados e normalizados
     */
    public function __invoke(LeadType $type, array $data): void
    {
        $consent = Consent::given(true, (string) config('pibls.privacy_policy_version'));

        DB::transaction(function () use ($type, $data, $consent): void {
            $lead = Lead::query()->create([
                ...$data,
                'type' => $type->value,
                'status' => LeadStatus::Novo->value,
                ...$consent->toAttributes(),
                'status_changed_at' => $consent->at,
            ]);

            event(new LeadReceived(
                $lead->id,
                $type,
                $lead->ministry_id,
                CarbonImmutable::instance($lead->created_at ?? now()),
            ));
        });
    }
}
