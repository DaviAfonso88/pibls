<?php

declare(strict_types=1);

namespace App\Modules\Access\Models;

use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

/**
 * Matriz dos papéis de referência (papel × permissão). Os dados entram por migration; a aplicação só lê (BR-077).
 * A chave primária é composta, então o Eloquent não a usa.
 *
 * @property string $role_code
 * @property string $permission_key
 */
#[Table(name: 'role_templates', incrementing: false, timestamps: false)]
class RoleTemplate extends Model
{
    protected $primaryKey = null;
}
