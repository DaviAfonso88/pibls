<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Dados obrigatórios: todas as chaves de `site_settings`, com os valores do Guia Institucional.
// `insertOrIgnore` (e não `upsert`) de propósito: se a Secretaria já editou uma chave, rodar o seed de novo
// não pode desfazer a edição.
return new class extends Migration
{
    public function up(): void
    {
        /** @var array{site_settings: array<string, array{0: bool, 1: array<mixed>}>} $content */
        $content = require database_path('data/initial_content.php');

        $now = now()->utc()->format('Y-m-d H:i:s');

        $rows = [];
        foreach ($content['site_settings'] as $key => [$isPublic, $value]) {
            $rows[] = [
                'key' => $key,
                'value' => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
                'is_public' => $isPublic,
                'updated_by' => null,
                'updated_at' => $now,
            ];
        }

        DB::table('site_settings')->insertOrIgnore($rows);
    }

    public function down(): void
    {
        /** @var array{site_settings: array<string, mixed>} $content */
        $content = require database_path('data/initial_content.php');

        DB::table('site_settings')->whereIn('key', array_keys($content['site_settings']))->delete();
    }
};
