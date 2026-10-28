<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Actions;

use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Illuminate\Support\Facades\DB;

/**
 * Cadastra um ministério, grupo ou Célula de CL (CAP-16). O item novo vai para o fim da lista quando a ordem não é
 * informada. A auditoria guarda quais campos foram preenchidos, nunca os valores: endereço e e-mail são dado pessoal.
 */
final class CreateMinistryGroup
{
    public function __construct(
        private readonly PrepareMinistryFields $prepare,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $input  `category`, `name` e os campos opcionais do contrato `MinistryInput`
     */
    public function __invoke(array $input, int $actorId): MinistryGroup
    {
        $fields = ($this->prepare)($input);

        return DB::transaction(function () use ($fields, $actorId): MinistryGroup {
            $ministry = new MinistryGroup;
            $ministry->fill([
                'is_active' => true,
                'display_order' => (int) MinistryGroup::query()->max('display_order') + 1,
                ...$fields,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
            $ministry->save();

            $this->audit->record(AuditAction::MinistryCreated, 'ministry', $ministry->getKey(), [
                'category' => $ministry->category,
                'label' => $ministry->name,
                'fields' => array_keys($fields),
            ]);
            event(new PublicContentChanged(['ministries']));

            return $ministry->refresh();
        });
    }
}
