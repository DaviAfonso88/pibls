<?php

declare(strict_types=1);

namespace App\Modules\Access\Authorization;

use App\Modules\Access\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Autorização por permissão (Security → Autorização). Um Gate por `permission_key`, de modo que qualquer rota use
 * `->middleware('can:leads.read')` e qualquer Policy use `Gate::allows('leads.read')`.
 *
 * - As permissões do usuário são carregadas uma vez por requisição: a relação `permissions` fica na própria instância do
 *   usuário, que o guard cria de novo a cada requisição.
 * - As linhas de `user_permissions` são aditivas: a permissão efetiva é a união delas (FR-027).
 * - Escopo `.own` (ABAC simples): vale só se o usuário tem ministério vinculado (BR-075). Com um ministério como
 *   argumento (`Gate::allows('eventos.write.own', $event->ministry_id)`), ele também precisa ser o do usuário. Sem
 *   argumento, a pergunta é "esta pessoa tem esse poder em algum ministério?" (menu e `me`).
 * - Quem decide é sempre o servidor (BR-076); o frontend só recebe a lista para montar a interface.
 */
final class PermissionGate
{
    public function register(): void
    {
        foreach (PermissionKey::cases() as $key) {
            Gate::define(
                $key->value,
                fn (User $user, ?int $ministryId = null): bool => $this->allows($user, $key, $ministryId),
            );
        }
    }

    public function allows(User $user, PermissionKey $key, ?int $ministryId = null): bool
    {
        if (! in_array($key->value, $this->keysOf($user), true)) {
            return false;
        }

        if (! $key->isOwnScope()) {
            return true;
        }

        // BR-075: sem ministério vinculado, `.own` não concede nada
        if ($user->ministry_id === null) {
            return false;
        }

        return $ministryId === null || $ministryId === $user->ministry_id;
    }

    /**
     * @return list<string> chaves concedidas, em ordem alfabética
     */
    public function keysOf(User $user): array
    {
        $user->loadMissing('permissions');

        $keys = $user->permissions->pluck('permission_key')->unique()->sort()->values()->all();

        return array_values(array_map(strval(...), $keys));
    }

    /**
     * @return list<string> papéis de origem das permissões (`role_code`), sem repetição, em ordem alfabética
     */
    public function rolesOf(User $user): array
    {
        $user->loadMissing('permissions');

        $roles = $user->permissions->pluck('role_code')->unique()->sort()->values()->all();

        return array_values(array_map(strval(...), $roles));
    }
}
