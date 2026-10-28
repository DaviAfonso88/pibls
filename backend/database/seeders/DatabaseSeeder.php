<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Os dados obrigatórios (permissões, configurações, catálogo) entram por migration, não por seeder.
     * Aqui só o que é falso, e só fora de produção.
     */
    public function run(): void
    {
        if (! app()->isProduction()) {
            $this->call(LocalDevelopmentSeeder::class);
        }
    }
}
