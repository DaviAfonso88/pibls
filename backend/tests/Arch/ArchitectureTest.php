<?php

declare(strict_types=1);

use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\RoleTemplate;
use App\Modules\Access\Models\UserPermission;
use App\Shared\ValueObjects\InvalidValueObject;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Unguarded;
use Symfony\Component\Finder\Finder;

/*
|--------------------------------------------------------------------------
| Regras de dependência (architecture.md → Estrutura de pastas → Regras de dependência; Domain Model)
|--------------------------------------------------------------------------
*/

/**
 * Quem pode depender de quem, conforme a coluna "Depende de" do Domain Model.
 * `Platform` é transversal e não depende de nenhum módulo de negócio.
 */
const MODULE_DEPENDENCIES = [
    'Access' => ['Ministries', 'Platform'],
    'Ministries' => ['Platform'],
    'Content' => ['Access', 'Platform'],
    'Leads' => ['Access', 'Ministries', 'Content', 'Platform'],
    'Events' => ['Access', 'Ministries', 'Platform'],
    'Platform' => [],
];

foreach (MODULE_DEPENDENCIES as $module => $allowed) {
    $forbidden = array_values(array_map(
        fn (string $other) => "App\\Modules\\{$other}",
        array_diff(array_keys(MODULE_DEPENDENCIES), [$module], $allowed),
    ));

    if ($forbidden === []) {
        continue;
    }

    arch("o módulo {$module} só depende de ".(implode(', ', $allowed) ?: 'ninguém'))
        ->expect("App\\Modules\\{$module}")
        ->not->toUse($forbidden);
}

arch('Platform não depende de nenhum módulo de negócio')
    ->expect('App\Modules\Platform')
    ->not->toUse([
        'App\Modules\Access', 'App\Modules\Ministries', 'App\Modules\Content', 'App\Modules\Leads', 'App\Modules\Events',
    ]);

arch('o código compartilhado (Shared) não depende dos módulos')
    ->expect('App\Shared')
    ->not->toUse('App\Modules');

arch('Controllers não usam DB nem o Query Builder direto: validam com Form Request e chamam uma Action')
    ->expect('App\Modules\*\Http\Controllers')
    ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Database\Query\Builder', 'Illuminate\Database\Eloquent\Builder']);

arch('Value Objects comuns são imutáveis')
    ->expect('App\Shared\ValueObjects')
    ->classes()
    ->toBeReadonly()
    ->ignoring(InvalidValueObject::class);

arch('o código não deixa depuração para trás')
    ->expect(['dd', 'dump', 'var_dump', 'print_r', 'ray', 'die', 'exit'])
    ->not->toBeUsed();

arch('o código da aplicação usa strict_types')
    ->expect('App')
    ->toUseStrictTypes()
    ->ignoring([
        // Arquivos gerados pelo Laravel na instalação, ainda sem declarar strict_types
        'App\Http\Controllers\Controller',
        // PoC de desempenho (T013), removida na T015
        'App\Poc',
    ]);

/*
|--------------------------------------------------------------------------
| Fonte do código: busca textual nos arquivos
|--------------------------------------------------------------------------
*/

/**
 * @return list<array{0: string, 1: string}> pares [caminho relativo, conteúdo]
 */
function phpSources(string $directory, string $glob = '*.php'): array
{
    $files = [];
    foreach ((new Finder)->files()->in($directory)->name($glob)->sortByName() as $file) {
        $files[] = [str_replace(dirname(__DIR__, 2).DIRECTORY_SEPARATOR, '', (string) $file->getRealPath()), $file->getContents()];
    }

    return $files;
}

/**
 * Procura, num trecho de código, escrita nas tabelas de permissões (BR-077): chamadas estáticas de escrita nos
 * models, `DB::table('…')->insert/update/delete…` e SQL cru de escrita.
 *
 * @param  list<string>  $models  nomes curtos dos models (`UserPermission`)
 * @param  list<string>  $tables  nomes das tabelas (`user_permissions`)
 * @return list<string> o que foi encontrado
 */
function permissionWrites(string $source, array $models, array $tables): array
{
    $writes = 'create|forceCreate|insert|insertOrIgnore|insertGetId|upsert|update|updateOrCreate|firstOrCreate|firstOrNew|delete|destroy|truncate|forceDelete|save|saveMany|fill|sync|attach|detach|toggle';
    $found = [];

    foreach ($models as $model) {
        if (preg_match_all("/\\b{$model}\\s*::\\s*(?:query\\(\\)\\s*->\\s*|where\\w*\\([^;]*?\\)\\s*->\\s*)?(?:{$writes})\\s*\\(/", $source, $m) > 0) {
            array_push($found, ...$m[0]);
        }
        if (preg_match_all("/\\bnew\\s+{$model}\\b/", $source, $m) > 0) {
            array_push($found, ...$m[0]);
        }
    }

    foreach ($tables as $table) {
        if (preg_match_all("/table\\(\\s*['\"]{$table}['\"]\\s*\\)[^;]*?->\\s*(?:{$writes})\\s*\\(/s", $source, $m) > 0) {
            array_push($found, ...$m[0]);
        }
        if (preg_match_all("/\\b(?:INSERT\\s+(?:IGNORE\\s+)?INTO|UPDATE|DELETE\\s+FROM|REPLACE\\s+INTO|TRUNCATE(?:\\s+TABLE)?|ALTER\\s+TABLE|DROP\\s+TABLE)\\s+`?{$table}`?\\b/i", $source, $m) > 0) {
            array_push($found, ...$m[0]);
        }
    }

    return $found;
}

const PERMISSION_MODELS = ['UserPermission', 'Permission', 'RoleTemplate'];
const PERMISSION_TABLES = ['user_permissions', 'permissions', 'role_templates'];

it('BR-077 nenhum código da aplicação escreve em user_permissions, permissions ou role_templates', function () {
    $violations = [];

    foreach (phpSources(dirname(__DIR__, 2).'/app') as [$path, $source]) {
        foreach (permissionWrites($source, PERMISSION_MODELS, PERMISSION_TABLES) as $write) {
            $violations[] = "{$path}: {$write}";
        }
    }

    expect($violations)->toBe([]);
});

it('BR-077 o detector de escrita acerta: pega as formas de escrever e deixa passar a leitura', function (string $code, bool $isWrite) {
    $found = permissionWrites($code, PERMISSION_MODELS, PERMISSION_TABLES);

    expect($found !== [])->toBe($isWrite);
})->with([
    'UserPermission::create' => ['UserPermission::create([...]);', true],
    'UserPermission::insert' => ['UserPermission::insert($rows);', true],
    'UserPermission::updateOrCreate' => ['UserPermission::updateOrCreate($a, $b);', true],
    'UserPermission::query()->delete' => ['UserPermission::query()->delete();', true],
    'UserPermission::where()->delete' => ["UserPermission::where('user_id', 1)->delete();", true],
    'UserPermission::destroy' => ['UserPermission::destroy(1);', true],
    'new UserPermission' => ['$p = new UserPermission;', true],
    'Permission::create' => ["Permission::create(['key' => 'x']);", true],
    'RoleTemplate::upsert' => ['RoleTemplate::upsert($rows, []);', true],
    'DB::table insert' => ["DB::table('user_permissions')->insert([]);", true],
    'DB::table where delete' => ["DB::table('role_templates')\n    ->where('role_code', 'X')\n    ->delete();", true],
    'DB::table upsert' => ["DB::table('permissions')->upsert([], ['key']);", true],
    'SQL INSERT' => ["DB::statement('INSERT INTO user_permissions (user_id) VALUES (1)');", true],
    'SQL INSERT IGNORE' => ["DB::statement('INSERT IGNORE INTO user_permissions SELECT 1');", true],
    'SQL UPDATE' => ["DB::update('UPDATE permissions SET description = ?');", true],
    'SQL DELETE' => ['DB::delete("DELETE FROM role_templates");', true],
    'leitura pelo model' => ["UserPermission::query()->where('user_id', 1)->pluck('permission_key');", false],
    'leitura pelo relacionamento' => ['$user->permissions()->get();', false],
    'leitura pelo DB' => ["DB::table('user_permissions')->where('user_id', 1)->pluck('permission_key');", false],
    'SQL SELECT' => ["DB::select('SELECT * FROM permissions');", false],
    'outra tabela' => ["DB::table('users')->update(['last_login_at' => now()]);", false],
]);

it('BR-077 os models das tabelas de permissões não aceitam atribuição em massa', function (string $model) {
    $reflection = new ReflectionClass($model);

    expect($reflection->getAttributes(Fillable::class))->toBe([])
        ->and($reflection->getAttributes(Unguarded::class))->toBe([]);
})->with([UserPermission::class, Permission::class, RoleTemplate::class]);

it('Controllers não chamam Model::query() nem o Query Builder: a regra fica na Action', function () {
    $pattern = '/\bDB::|::query\s*\(|::(?:where|find|findOrFail|first|all|create|firstOrCreate|updateOrCreate|insert|upsert|destroy)\s*\(|->(?:save|delete|update)\s*\(/';
    $violations = [];

    foreach (phpSources(dirname(__DIR__, 2).'/app/Modules', '*Controller.php') as [$path, $source]) {
        if (str_contains($path, 'Http'.DIRECTORY_SEPARATOR.'Controllers') && preg_match($pattern, $source, $match) === 1) {
            $violations[] = "{$path}: {$match[0]}";
        }
    }

    expect($violations)->toBe([]);
});

it('SQL cru só com bindings: nenhum DB::raw/whereRaw/selectRaw interpola variável', function () {
    $pattern = '/(?:DB::(?:raw|select|statement|unprepared|update|insert|delete)|->(?:whereRaw|selectRaw|orderByRaw|havingRaw|groupByRaw|fromRaw))\s*\(\s*(?:"[^"]*\$|\'[^\']*\'\s*\.\s*\$|\$)/';
    $violations = [];

    foreach (phpSources(dirname(__DIR__, 2).'/app') as [$path, $source]) {
        if (preg_match($pattern, $source, $match) === 1) {
            $violations[] = "{$path}: {$match[0]}";
        }
    }

    expect($violations)->toBe([]);
});
