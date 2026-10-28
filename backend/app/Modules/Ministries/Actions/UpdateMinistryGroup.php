<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Actions;

use App\Modules\Ministries\Models\MinistryGroup;
use App\Modules\Platform\Audit\AuditAction;
use App\Modules\Platform\Audit\AuditLogger;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use Illuminate\Support\Facades\DB;

/**
 * Altera, ordena, ativa ou desativa um item. Só os campos enviados mudam, mas o item inteiro precisa continuar completo
 * para a sua categoria (BR-049). Desativar tira o item do site e dos formulários na hora, sem apagá-lo.
 */
final class UpdateMinistryGroup
{
    public function __construct(
        private readonly PrepareMinistryFields $prepare,
        private readonly AuditLogger $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     */
    public function __invoke(MinistryGroup $ministry, array $input, int $actorId): MinistryGroup
    {
        $fields = ($this->prepare)($input, $ministry->only([
            'category', 'schedule_text', 'neighborhood',
        ]));

        return DB::transaction(function () use ($ministry, $fields, $actorId): MinistryGroup {
            // `name` é chave que o PiiScrubber trata como nome de pessoa; o nome do ministério vai como `label`
            $audited = ['category', 'name', 'display_order', 'is_active'];
            $before = $ministry->only($audited);

            $ministry->fill($fields);
            $changed = array_keys($ministry->getDirty());

            if ($changed === []) {
                return $ministry;
            }

            $ministry->updated_by = $actorId;
            $ministry->save();

            $after = $ministry->only($audited);
            $this->audit->record(AuditAction::MinistryUpdated, 'ministry', $ministry->getKey(), [
                'fields' => $changed,
                'before' => $this->labelled(array_diff_assoc($before, $after)),
                'after' => $this->labelled(array_diff_assoc($after, $before)),
            ]);
            event(new PublicContentChanged(['ministries']));

            return $ministry->refresh();
        });
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function labelled(array $values): array
    {
        if (array_key_exists('name', $values)) {
            $values['label'] = $values['name'];
            unset($values['name']);
        }

        return $values;
    }
}
