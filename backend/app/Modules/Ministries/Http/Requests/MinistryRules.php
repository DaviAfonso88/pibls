<?php

declare(strict_types=1);

namespace App\Modules\Ministries\Http\Requests;

use App\Modules\Ministries\Enums\MinistryCategory;
use App\Shared\Validation\ValidEmail;
use App\Shared\Validation\ValidPhone;
use Illuminate\Validation\Rule;

/**
 * As regras de forma de `MinistryInput` (contracts/openapi.yaml, CAP-16), comuns a criar e alterar. Ao criar, `category`
 * e `name` são obrigatórios; ao alterar, todo campo é opcional. O que depende do item inteiro (BR-049, descrição
 * sanitizada) é conferido em `PrepareMinistryFields`.
 */
final class MinistryRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function for(bool $partial): array
    {
        $required = $partial ? ['sometimes', 'required'] : ['required'];
        $optional = $partial ? ['sometimes', 'nullable'] : ['nullable'];

        return [
            'category' => [...$required, 'string', Rule::enum(MinistryCategory::class)],
            'name' => [...$required, 'string', 'min:2', 'max:120'],
            'description' => [...$optional, 'string', 'max:30000'],
            'leaders_text' => [...$optional, 'string', 'max:500'],
            'schedule_text' => [...$optional, 'string', 'max:120'],
            'neighborhood' => [...$optional, 'string', 'min:2', 'max:80'],
            'private_address' => [...$optional, 'string', 'max:300'],
            'contact_phone' => [...$optional, 'string', new ValidPhone],
            'contact_email' => [...$optional, 'string', new ValidEmail],
            'display_order' => [...($partial ? ['sometimes'] : ['nullable']), 'integer', 'min:0', 'max:65535'],
            'is_active' => [...($partial ? ['sometimes'] : ['nullable']), 'boolean'],
        ];
    }
}
