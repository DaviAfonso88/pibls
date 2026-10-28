<?php

declare(strict_types=1);

namespace App\Modules\Leads\Rules;

use App\Modules\Ministries\Enums\MinistryCategory;
use App\Modules\Ministries\Models\MinistryGroup;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** O grupo escolhido na Ficha de Visitante precisa ser um grupo ou uma célula ativos (BR-006). */
final class ActiveGroup implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $exists = is_int($value)
            && MinistryGroup::query()
                ->whereKey($value)
                ->where('is_active', true)
                ->whereIn('category', [MinistryCategory::Grupo->value, MinistryCategory::Celula->value])
                ->exists();

        if (! $exists) {
            $fail(__('business.BR-006.1'));
        }
    }
}
