<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// ADR-028: ajuste da matriz dos papéis de referência em bancos que já têm o seed original.
// Só mexe em `role_templates` (o modelo para usuários NOVOS). A cópia em `user_permissions` de quem já existe não muda
// aqui: o administrador técnico aplica por SQL, como no runbook provisionar-usuario.md (BR-077). Idempotente.
return new class extends Migration
{
    /** @var array<string, list<string>> */
    private const ADDED = [
        'SECRETARIA' => ['boletins.write'],
        'PASTORAL' => ['leads.manage', 'leads.oracao.manage'],
        'ADMIN_TECNICO' => ['settings.write'],
    ];

    /** @var array<string, list<string>> */
    private const REMOVED = [
        'PASTORAL' => ['users.read'],
    ];

    public function up(): void
    {
        $this->apply(self::ADDED, self::REMOVED);
    }

    public function down(): void
    {
        $this->apply(self::REMOVED, self::ADDED);
    }

    /**
     * @param  array<string, list<string>>  $toAdd
     * @param  array<string, list<string>>  $toRemove
     */
    private function apply(array $toAdd, array $toRemove): void
    {
        $rows = [];
        foreach ($toAdd as $roleCode => $keys) {
            foreach ($keys as $key) {
                $rows[] = ['role_code' => $roleCode, 'permission_key' => $key];
            }
        }
        DB::table('role_templates')->insertOrIgnore($rows);

        foreach ($toRemove as $roleCode => $keys) {
            DB::table('role_templates')->where('role_code', $roleCode)->whereIn('permission_key', $keys)->delete();
        }
    }
};
