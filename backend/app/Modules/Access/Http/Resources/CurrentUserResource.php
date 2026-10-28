<?php

declare(strict_types=1);

namespace App\Modules\Access\Http\Resources;

use App\Modules\Access\Authorization\PermissionGate;
use App\Modules\Access\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Corpo de `GET /api/auth/me` e do login (`Me` no contrato). As `permissions` servem só para a SPA montar o menu e os
 * botões; quem decide é o servidor, em toda rota (BR-076).
 *
 * @mixin User
 */
class CurrentUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $gate = app(PermissionGate::class);

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'ministry' => $this->ministry === null ? null : [
                'id' => $this->ministry->getKey(),
                'name' => $this->ministry->name,
            ],
            'roles' => $gate->rolesOf($this->resource),
            'permissions' => $gate->keysOf($this->resource),
        ];
    }
}
