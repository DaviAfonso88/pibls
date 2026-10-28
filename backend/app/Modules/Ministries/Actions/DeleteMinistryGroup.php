<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Actions;

use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Support\Facades\DB;

/**
 * Exclui um item do catálogo, e só se nada o referenciar: usuário do painel (`users.ministry_id`), contato
 * (`leads_messages.ministry_id`) ou evento (`events.ministry_id`). Com vínculo, a regra BR-047 manda desativar em vez de
 * excluir. As tabelas são lidas direto porque a Ministries não depende dos módulos que as têm.
 */
final class DeleteMinistryGroup
{
    /** @var list<string> tabela de cada vínculo (a coluna é sempre `ministry_id`) */
    private const REFERENCING_TABLES = ['users', 'leads_messages', 'events'];

    public function __construct(private readonly AuditLogger $audit) {}

    public function __invoke(MinistryGroup $ministry): void
    {
        DB::transaction(function () use ($ministry): void {
            // Trava a linha: um vínculo criado agora (um contato novo para este ministério) espera esta transação
            MinistryGroup::query()->whereKey($ministry->getKey())->lockForUpdate()->first();

            foreach (self::REFERENCING_TABLES as $table) {
                if (DB::table($table)->where('ministry_id', $ministry->getKey())->exists()) {
                    throw new BusinessRuleException('ITEM_IN_USE', __('business.BR-047'));
                }
            }

            $ministry->delete();

            $this->audit->record(AuditAction::MinistryDeleted, 'ministry', $ministry->getKey(), [
                'category' => $ministry->category,
                'label' => $ministry->name,
            ]);
            event(new PublicContentChanged(['ministries']));
        });
    }
}
