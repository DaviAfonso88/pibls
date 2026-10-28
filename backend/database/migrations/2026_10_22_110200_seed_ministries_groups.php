<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Dados obrigatórios: catálogo inicial de ministérios e grupos, com a liderança do Guia Institucional. Idempotente por (categoria, nome): um item que a
// Secretaria já renomeou ou reordenou não é recriado nem sobrescrito.
return new class extends Migration
{
    public function up(): void
    {
        /** @var array{ministries_groups: list<array{0: string, 1: string, 2: string|null, 3: string|null}>} $content */
        $content = require database_path('data/initial_content.php');

        $now = now()->utc()->format('Y-m-d H:i:s');

        foreach ($content['ministries_groups'] as $position => [$category, $name, $scheduleText, $leadersText]) {
            $exists = DB::table('ministries_groups')
                ->where('category', $category)
                ->where('name', $name)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('ministries_groups')->insert([
                'category' => $category,
                'name' => $name,
                'schedule_text' => $scheduleText,
                'leaders_text' => $leadersText,
                'display_order' => $position + 1,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        /** @var array{ministries_groups: list<array{0: string, 1: string, 2: string|null, 3: string|null}>} $content */
        $content = require database_path('data/initial_content.php');

        foreach ($content['ministries_groups'] as [$category, $name]) {
            DB::table('ministries_groups')->where('category', $category)->where('name', $name)->delete();
        }
    }
};
