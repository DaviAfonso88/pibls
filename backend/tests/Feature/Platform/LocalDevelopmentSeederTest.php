<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Leads\Models\Lead;
use Database\Seeders\LocalDevelopmentSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

use function Pest\Laravel\seed;

beforeEach(function () {
    config(['pibls.test_users_password' => 'senha-de-teste-123']);
});

it('cria um usuário por papel de referência com as permissões do papel', function () {
    seed(LocalDevelopmentSeeder::class);

    expect(User::query()->where('email', 'like', '%@pibls.test')->count())->toBe(7);

    $perRole = DB::table('user_permissions')->selectRaw('role_code, COUNT(DISTINCT permission_key) AS total')->groupBy('role_code')
        ->pluck('total', 'role_code')->all();
    $expected = DB::table('role_templates')->selectRaw('role_code, COUNT(*) AS total')->groupBy('role_code')
        ->pluck('total', 'role_code')->all();

    ksort($perRole);
    ksort($expected);

    expect($perRole)->toBe($expected);

    $secretaria = User::query()->where('email', 'secretaria@pibls.test')->firstOrFail();
    expect(Hash::check('senha-de-teste-123', $secretaria->password))->toBeTrue()
        ->and($secretaria->is_active)->toBeTrue();
});

it('cria também o usuário só dos testes de redefinição de senha, fora do domínio dos sete de papel', function () {
    seed(LocalDevelopmentSeeder::class);

    $reset = User::query()->where('email', 'redefinicao@pibls.example')->firstOrFail();

    expect($reset->is_active)->toBeTrue()
        ->and(Hash::check('senha-de-teste-123', $reset->password))->toBeTrue()
        ->and(DB::table('user_permissions')->where('user_id', $reset->getKey())->pluck('permission_key')->sort()->values()->all())
        ->toBe(['leads.oracao.manage', 'leads.oracao.read']);
});

it('BR-075 vincula um ministério só ao líder de ministério, que usa permissões .own', function () {
    seed(LocalDevelopmentSeeder::class);

    expect(User::query()->where('email', 'lider@pibls.test')->value('ministry_id'))->not->toBeNull()
        ->and(User::query()->where('email', 'secretaria@pibls.test')->value('ministry_id'))->toBeNull();
});

it('popula dados falsos e não duplica ao rodar de novo', function () {
    seed(LocalDevelopmentSeeder::class);
    $bulletins = Bulletin::query()->count();
    $leads = Lead::query()->count();

    seed(LocalDevelopmentSeeder::class);

    expect($bulletins)->toBeGreaterThan(0)
        ->and($leads)->toBeGreaterThan(0)
        ->and(Bulletin::query()->count())->toBe($bulletins)
        ->and(Lead::query()->count())->toBe($leads)
        ->and(User::query()->where('email', 'like', '%@pibls.test')->count())->toBe(7);
});

it('exige TEST_USERS_PASSWORD', function () {
    config(['pibls.test_users_password' => null]);

    expect(fn () => seed(LocalDevelopmentSeeder::class))->toThrow(RuntimeException::class, 'TEST_USERS_PASSWORD');
});

it('recusa rodar em produção', function () {
    app()->detectEnvironment(fn () => 'production');

    // Direto no seeder: `db:seed` em produção pede --force antes de chegar nele
    expect(fn () => (new LocalDevelopmentSeeder)->run())->toThrow(RuntimeException::class, 'produção');
});
