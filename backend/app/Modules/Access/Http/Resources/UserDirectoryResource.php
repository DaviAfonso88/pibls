<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Resources;

use App\Modules\Access\Models\User;
use Illuminate\Http\Request;

/**
 * Item do diretório de usuários (`UserDirectoryItem`): o mesmo corpo do `me` mais `is_active` e, para a coluna "Último
 * acesso" do painel, `last_login_at` (UTC). O diretório é somente leitura (BR-077).
 *
 * @mixin User
 */
final class UserDirectoryResource extends CurrentUserResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            'is_active' => $this->is_active,
            'last_login_at' => $this->last_login_at?->toIso8601ZuluString(),
        ];
    }
}
