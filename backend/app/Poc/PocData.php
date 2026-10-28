<?php

declare(strict_types=1);

namespace App\Poc;

use Illuminate\Support\Facades\DB;

/**
 * PoC F0-03 (T013): dados falsos para a consulta com join. REMOVER na T015.
 */
final class PocData
{
    private const CATEGORIES = [
        'ministerio' => 'Ministérios',
        'celula' => 'Células de CL',
        'jovens' => 'Jovens',
        'homens' => 'Homens',
        'mulheres' => 'Mulheres',
        'criancas' => 'Crianças',
        'oracao' => 'Oração',
        'missoes' => 'Missões',
    ];

    public static function seed(int $groups): void
    {
        DB::table('poc_ministry_groups')->delete();
        DB::table('poc_categories')->delete();

        $order = 0;
        foreach (self::CATEGORIES as $slug => $name) {
            DB::table('poc_categories')->insert([
                'slug' => $slug,
                'name' => $name,
                'display_order' => ++$order,
            ]);
        }

        $categoryIds = DB::table('poc_categories')->orderBy('display_order')->pluck('id')->all();
        $now = now();
        $rows = [];

        for ($i = 1; $i <= $groups; $i++) {
            $rows[] = [
                'category_id' => $categoryIds[($i - 1) % count($categoryIds)],
                'name' => 'Grupo '.$i,
                'neighborhood' => 'Bairro '.(($i % 17) + 1),
                'is_active' => $i % 10 !== 0,
                'display_order' => $i,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 100) as $chunk) {
            DB::table('poc_ministry_groups')->insert($chunk);
        }
    }
}
