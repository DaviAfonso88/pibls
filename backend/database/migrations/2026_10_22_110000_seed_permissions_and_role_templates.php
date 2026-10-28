<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Dados obrigatórios: as 14 chaves de permissão e a matriz dos 7 papéis de referência.
// É migration (e não código da aplicação), por isso não fere a BR-077. Idempotente: pode rodar de novo sem duplicar.
return new class extends Migration
{
    public function up(): void
    {
        /** @var array{permissions: array<string, array{0: string, 1: bool}>, role_templates: array<string, list<string>>} $content */
        $content = require database_path('data/initial_content.php');

        $permissions = [];
        foreach ($content['permissions'] as $key => [$description, $isOwnScope]) {
            $permissions[] = ['key' => $key, 'description' => $description, 'is_own_scope' => $isOwnScope];
        }
        DB::table('permissions')->upsert($permissions, ['key'], ['description', 'is_own_scope']);

        $templates = [];
        foreach ($content['role_templates'] as $roleCode => $keys) {
            foreach ($keys as $key) {
                $templates[] = ['role_code' => $roleCode, 'permission_key' => $key];
            }
        }
        DB::table('role_templates')->insertOrIgnore($templates);
    }

    public function down(): void
    {
        /** @var array{permissions: array<string, mixed>} $content */
        $content = require database_path('data/initial_content.php');

        DB::table('role_templates')->delete();
        DB::table('permissions')->whereIn('key', array_keys($content['permissions']))->delete();
    }
};
