<?php

declare(strict_types=1);

namespace App\Modules\Access\Models;

use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Permissão concedida a um usuário. Escrita só pelo phpMyAdmin (BR-077, teste de arquitetura): a aplicação só lê.
 * As permissões efetivas são a união das linhas do usuário (aditivas, FR-027).
 *
 * @property int $id
 * @property int $user_id
 * @property string $role_code
 * @property string $permission_key
 */
#[Table(name: 'user_permissions')]
class UserPermission extends Model
{
    public const UPDATED_AT = null;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['created_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
