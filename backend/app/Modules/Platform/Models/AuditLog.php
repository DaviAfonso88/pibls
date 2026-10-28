<?php

declare(strict_types=1);

namespace App\Modules\Platform\Models;

use Illuminate\Database\Eloquent\Attributes\DateFormat;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Registro de auditoria. Só inclusão; `changes` guarda apenas dados não pessoais.
 * O momento tem milissegundos (DATETIME(3)), por isso o formato próprio.
 *
 * @property int $id
 * @property Carbon $occurred_at
 * @property int|null $actor_user_id
 * @property string $action
 * @property string|null $resource_type
 * @property string|null $resource_id
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string|null $correlation_id
 * @property array<string, mixed>|null $changes
 */
#[Table(name: 'audit_logs', timestamps: false)]
#[DateFormat('Y-m-d H:i:s.v')]
#[Fillable([
    'occurred_at', 'actor_user_id', 'action', 'resource_type', 'resource_id', 'ip_address', 'user_agent',
    'correlation_id', 'changes',
])]
class AuditLog extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'changes' => 'array',
        ];
    }
}
