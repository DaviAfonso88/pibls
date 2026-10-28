<?php

declare(strict_types=1);

namespace App\Modules\Leads\Rules;

use App\Modules\Ministries\Enums\MinistryCategory;
use App\Modules\Ministries\Models\MinistryGroup;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/** O contato com ministério exige um ministério existente e ativo (BR-006). */
final class ActiveMinistry implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $exists = is_int($value)
            && MinistryGroup::query()
                ->whereKey($value)
                ->where('is_active', true)
                ->where('category', MinistryCategory::Ministerio->value)
                ->exists();

        if (! $exists) {
            $fail(__('business.BR-006.0'));
        }
    }
}
