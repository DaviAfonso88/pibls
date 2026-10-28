<?php

declare(strict_types=1);

use App\Modules\Access\Http\Middleware\EnforceSessionLimits;
use App\Modules\Access\Models\User;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

/*
| Diretório de usuários (architecture.md → GET /api/admin/users; BG-4, BR-077). Somente leitura: usuários e permissões
| são criados, alterados e desativados no phpMyAdmin.
*/

function asDirectoryReader(string $role = 'PASTORAL'): void
{
    test()->actingAs(userWithRole($role, ['name' => 'Aaa Leitor']))
        ->withSession([EnforceSessionLimits::LOGIN_AT => time()]);
}

it('lista os usuários com papéis, permissões e ministério, para quem tem users.read', function (string $role) {
    $ministry = MinistryGroup::factory()->create(['name' => 'Juventude']);
    userWithRole('LIDER_MINISTERIO', ['name' => 'Bruno Líder', 'email' => 'bruno@pibls.test', 'ministry_id' => $ministry->getKey()]);
    asDirectoryReader($role);

    $response = $this->getJson('/api/admin/users')->assertOk();

    $response->assertJsonPath('meta', ['page' => 1, 'per_page' => 25, 'total' => 2, 'last_page' => 1]);
    $leader = collect($response->json('data'))->firstWhere('email', 'bruno@pibls.test');
    expect($leader)->toMatchArray([
        'name' => 'Bruno Líder',
        'is_active' => true,
        'ministry' => ['id' => $ministry->getKey(), 'name' => 'Juventude'],
        'roles' => ['LIDER_MINISTERIO'],
        'permissions' => ['eventos.inscricoes.read.own', 'eventos.write.own'],
        'last_login_at' => null,
    ]);
})->with(['pastoral' => 'PASTORAL', 'administrador técnico' => 'ADMIN_TECNICO']);

it('nunca devolve senha, token de lembrança nem hash', function () {
    asDirectoryReader();

    $body = $this->getJson('/api/admin/users')->assertOk()->getContent();

    expect($body)->not->toContain('password')->and($body)->not->toContain('remember_token')->and($body)->not->toContain('$2y$');
});

it('mostra o último acesso em UTC', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test']);
    DB::table('users')->where('id', $user->getKey())->update(['last_login_at' => '2026-10-20 11:40:00']);
    asDirectoryReader();

    $row = collect($this->getJson('/api/admin/users')->json('data'))->firstWhere('email', 'secretaria@pibls.test');

    expect($row['last_login_at'])->toBe('2026-10-20T11:40:00Z');
});

it('filtra por ativo e por ministério', function () {
    $ministry = MinistryGroup::factory()->create();
    userWithRole('LIDER_MINISTERIO', ['name' => 'Líder Ativo', 'ministry_id' => $ministry->getKey()]);
    userWithRole('LIDER_MINISTERIO', ['name' => 'Líder Inativo', 'ministry_id' => $ministry->getKey(), 'is_active' => false]);
    userWithRole('SECRETARIA', ['name' => 'Sem Ministério']);
    asDirectoryReader();

    $names = fn (string $query) => collect($this->getJson("/api/admin/users?{$query}")->assertOk()->json('data'))->pluck('name')->all();

    expect($names("ministry_id={$ministry->getKey()}"))->toBe(['Líder Ativo', 'Líder Inativo'])
        ->and($names("ministry_id={$ministry->getKey()}&is_active=true"))->toBe(['Líder Ativo'])
        ->and($names("ministry_id={$ministry->getKey()}&is_active=false"))->toBe(['Líder Inativo'])
        ->and($names('is_active=0'))->toBe(['Líder Inativo'])
        ->and($names('is_active=1'))->toContain('Aaa Leitor', 'Líder Ativo', 'Sem Ministério')->not->toContain('Líder Inativo');
});

it('ordena por nome, crescente por padrão e decrescente com -name', function () {
    userWithRole('SECRETARIA', ['name' => 'Carla']);
    userWithRole('SECRETARIA', ['name' => 'Bruna']);
    asDirectoryReader();

    expect(collect($this->getJson('/api/admin/users')->json('data'))->pluck('name')->all())->toBe(['Aaa Leitor', 'Bruna', 'Carla'])
        ->and(collect($this->getJson('/api/admin/users?sort=-name')->json('data'))->pluck('name')->all())->toBe(['Carla', 'Bruna', 'Aaa Leitor']);
});

it('pagina com page e per_page e informa o total', function () {
    User::factory()->count(6)->sequence(fn ($sequence) => ['name' => 'Pessoa '.($sequence->index + 1)])->create();
    asDirectoryReader();

    $response = $this->getJson('/api/admin/users?per_page=3&page=2')->assertOk();

    $response->assertJsonPath('meta', ['page' => 2, 'per_page' => 3, 'total' => 7, 'last_page' => 3]);
    expect($response->json('data'))->toHaveCount(3);
});

it('recusa parâmetros inválidos', function (string $query, string $field) {
    asDirectoryReader();

    $this->getJson("/api/admin/users?{$query}")
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', $field);
})->with([
    'per_page acima do máximo' => ['per_page=101', 'per_page'],
    'per_page zero' => ['per_page=0', 'per_page'],
    'ordenação desconhecida' => ['sort=email', 'sort'],
    'is_active inválido' => ['is_active=talvez', 'is_active'],
    'página zero' => ['page=0', 'page'],
]);

it('não tem consultas N+1: o número de consultas não cresce com os usuários', function () {
    asDirectoryReader();
    User::factory()->count(3)->create();
    DB::enableQueryLog();
    DB::flushQueryLog();
    $this->getJson('/api/admin/users')->assertOk();
    $few = count(DB::getQueryLog());

    User::factory()->count(20)->create();
    DB::flushQueryLog();
    $this->getJson('/api/admin/users')->assertOk();

    // A 1ª requisição também carrega as permissões do usuário que consulta (a instância é reaproveitada no teste)
    expect(count(DB::getQueryLog()))->toBeLessThanOrEqual($few);
});

it('BR-077 não existe rota de escrita para usuários nem permissões', function (string $method, string $uri) {
    asDirectoryReader();

    expect($this->json($method, $uri, ['name' => 'x'])->getStatusCode())->toBeIn([404, 405]);
})->with([
    'POST /users' => ['POST', '/api/admin/users'],
    'PUT /users' => ['PUT', '/api/admin/users'],
    'PATCH /users/1' => ['PATCH', '/api/admin/users/1'],
    'DELETE /users/1' => ['DELETE', '/api/admin/users/1'],
    'POST /users/1/permissions' => ['POST', '/api/admin/users/1/permissions'],
    'PUT /permissions' => ['PUT', '/api/admin/permissions'],
]);

it('BR-077 nenhuma rota registrada cria, altera ou apaga usuários e permissões', function () {
    $writes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn ($route) => array_intersect($route->methods(), ['POST', 'PUT', 'PATCH', 'DELETE']) !== [])
        ->map(fn ($route) => $route->uri())
        ->filter(fn (string $uri) => preg_match('#^api/admin/(users|permissions|roles)#', $uri) === 1)
        ->all();

    expect($writes)->toBe([]);
});

it('quem não tem users.read recebe 403, mesmo autenticado', function () {
    asDirectoryReader('COMUNICACAO');

    $this->getJson('/api/admin/users')->assertForbidden();
});
