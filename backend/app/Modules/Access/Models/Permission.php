<?php

declare(strict_types=1);

namespace App\Modules\Access\Models;

use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * Catálogo de permissões. Os dados entram por migration; a aplicação só lê (BR-077).
 *
 * @property string $key
 * @property string $description
 * @property bool $is_own_scope
 */
#[Table(name: 'permissions', key: 'key', keyType: 'string', incrementing: false, timestamps: false)]
class Permission extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_own_scope' => 'boolean'];
    }
}
