<?php

declare(strict_types=1);

use App\Modules\Access\Authorization\PermissionKey;
use App\Modules\Access\Http\Middleware\EnforceSessionLimits;
use App\Modules\Access\Models\User;
use App\Modules\Events\Models\Event;
use App\Modules\Events\Models\EventRegistration;
use App\Modules\Ministries\Models\MinistryGroup;
use Illuminate\Routing\Route as LaravelRoute;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;

/*
| Matriz papel × rota (architecture.md → Security → Autorização; BR-075, BR-076). A tabela de rotas é
| tests/Feature/Access/admin-routes.php e cada história de painel acrescenta as suas.
*/

/** @return list<array<string, mixed>> */
function adminRoutes(): array
{
    /** @var list<array<string, mixed>> $routes */
    $routes = require __DIR__.'/admin-routes.php';

    return $routes;
}

/** O nome do caso no relatório: método, rota e a permissão que a libera. */
function routeLabel(array $row): string
{
    return $row['method'].' '.($row['uri'] !== '' ? $row['uri'] : $row['route']).' ['.implode('|', $row['permissions']).']';
}

/**
 * A rota a chamar: a `uri` da tabela, ou a que `make` devolve depois de criar o registro. O `make` recebe o usuário que vai
 * chamar (quando há), para criar o registro no escopo dele (o evento no ministério do líder, por exemplo).
 */
function routeUri(array $row, ?User $user = null): string
{
    return isset($row['make']) ? ($row['make'])($user) : $row['uri'];
}

/** Um evento no ministério do usuário (ou num ministério novo, se ele não tem), para as rotas de um evento. */
function eventOf(?User $user): Event
{
    return Event::factory()->create(['ministry_id' => $user?->ministry_id ?? MinistryGroup::factory()->create()->getKey()]);
}

/** A rota das inscrições de um evento no ministério do usuário; com `$one`, a de uma inscrição só. */
function registrationOf(?User $user, bool $one = false): string
{
    $event = eventOf($user);
    $registration = EventRegistration::factory()->create(['event_id' => $event->getKey()]);

    return "/api/admin/events/{$event->getKey()}/registrations".($one ? "/{$registration->getKey()}" : '');
}

// As rotas de eventos só existem com a flag ligada (R2); a matriz as cobre ligada
beforeEach(fn () => config(['features.events' => true]));

/** O status de quem NÃO tem a permissão: 404 se o recurso é invisível para ele (BR-007), senão 403. */
function deniedStatus(array $row, array $rolePermissions): int
{
    if (! array_key_exists('visibleTo', $row)) {
        return 403;
    }

    return array_intersect($row['visibleTo'], $rolePermissions) !== [] ? 403 : 404;
}

/** @return array<string, list<string>> papel => chaves de permissão do modelo de papel */
function roleTemplates(): array
{
    return DB::table('role_templates')->get()
        ->groupBy('role_code')
        ->map(fn ($rows) => $rows->pluck('permission_key')->all())
        ->all();
}

dataset('matriz papel x rota', function () {
    foreach (ROLE_CODES as $role) {
        foreach (adminRoutes() as $row) {
            yield "{$role} em ".routeLabel($row) => [$role, $row];
        }
    }
});

dataset('rotas do painel', function () {
    foreach (adminRoutes() as $row) {
        yield routeLabel($row) => [$row];
    }
});

it('BR-076 cada papel só passa nas rotas cuja permissão tem; nas demais, 403 (ou 404 se o recurso é invisível, BR-007)', function (string $role, array $row) {
    $user = userWithRole($role);
    $own = roleTemplates()[$role] ?? [];
    $allowed = array_intersect($row['permissions'], $own) !== [];

    $response = $this->actingAs($user)
        ->withSession([EnforceSessionLimits::LOGIN_AT => time()])
        ->json($row['method'], routeUri($row, $user), $row['body'] ?? []);

    if ($allowed) {
        // `validates`: a rota é multipart (envia arquivo), e a matriz manda JSON; 422 prova que a permissão passou e a validação falou
        isset($row['validates']) ? $response->assertStatus(422) : $response->assertSuccessful();

        return;
    }

    $status = deniedStatus($row, $own);
    $response->assertStatus($status);

    $status === 403
        ? $response->assertJsonPath('error.code', 'FORBIDDEN')->assertJsonPath('error.message', 'Você não tem permissão para esta ação.')
        : $response->assertJsonPath('error.code', 'NOT_FOUND');
})->with('matriz papel x rota');

it('BR-076 sem sessão, toda rota do painel responde 401', function (array $row) {
    $this->json($row['method'], routeUri($row), $row['body'] ?? [])
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'UNAUTHENTICATED');
})->with('rotas do painel');

it('BR-076 usuário sem nenhuma permissão não acessa nenhuma rota do painel', function (array $row) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->withSession([EnforceSessionLimits::LOGIN_AT => time()])
        ->json($row['method'], routeUri($row, $user), $row['body'] ?? [])
        ->assertStatus(deniedStatus($row, []));
})->with('rotas do painel');

it('BR-076 a tabela da matriz cobre TODAS as rotas /api/admin/* (história nova esquece de acrescentar a sua → falha)', function () {
    $registered = collect(Route::getRoutes()->getRoutes())
        ->filter(fn (LaravelRoute $route) => str_starts_with($route->uri(), 'api/admin/'))
        ->flatMap(fn (LaravelRoute $route) => collect($route->methods())
            ->reject(fn (string $method) => in_array($method, ['HEAD', 'OPTIONS'], true))
            ->map(fn (string $method) => "{$method} {$route->uri()}"))
        ->sort()->values()->all();

    $covered = collect(adminRoutes())->map(fn ($row) => "{$row['method']} {$row['route']}")->unique()->sort()->values()->all();

    expect($registered)->not->toBeEmpty()->and($covered)->toBe($registered);
});

it('BR-076 toda rota /api/admin/* exige sessão, limite de 12 h e usuário ativo, e confere a permissão (can: ou, quando depende do tipo, no controlador)', function () {
    $controllerGuarded = collect(adminRoutes())
        ->filter(fn ($row) => ($row['guard'] ?? 'middleware') === 'controller')
        ->map(fn ($row) => "{$row['method']} {$row['route']}")
        ->unique()->all();

    $routes = collect(Route::getRoutes()->getRoutes())
        ->filter(fn (LaravelRoute $route) => str_starts_with($route->uri(), 'api/admin/'));

    foreach ($routes as $route) {
        $middleware = $route->gatherMiddleware();
        $gate = collect($middleware)->first(fn ($item) => is_string($item) && str_starts_with($item, 'can:'));
        $declaredInController = collect($route->methods())
            ->contains(fn (string $method) => in_array("{$method} {$route->uri()}", $controllerGuarded, true));

        expect($middleware)->toContain('auth:web', 'session.limits', 'active.user')
            ->and($gate !== null || $declaredInController)->toBeTrue("A rota {$route->uri()} não tem `can:` nem está marcada como conferida no controlador");
    }
});

it('a permissão que a rota exige (can:) é a da tabela da matriz', function () {
    foreach (adminRoutes() as $row) {
        if (($row['guard'] ?? 'middleware') === 'controller') {
            continue;
        }

        $route = collect(Route::getRoutes()->getRoutes())
            ->first(fn (LaravelRoute $candidate) => $candidate->uri() === $row['route'] && in_array($row['method'], $candidate->methods(), true));

        $gates = collect($route->gatherMiddleware())
            ->filter(fn ($item) => is_string($item) && str_starts_with($item, 'can:'))
            ->map(fn (string $item) => substr($item, 4))
            ->all();

        expect($gates)->not->toBeEmpty()
            ->and(array_diff($gates, $row['permissions']))->toBe([], "{$row['route']}: o can: não está na tabela");
    }
});

// ───────────────────────────── Catálogo e Gates ─────────────────────────────

it('o enum PermissionKey tem exatamente as 14 chaves do catálogo `permissions`', function () {
    $catalog = DB::table('permissions')->pluck('key')->sort()->values()->all();
    $enum = collect(PermissionKey::cases())->map->value->sort()->values()->all();

    expect($catalog)->toHaveCount(14)->and($enum)->toBe($catalog);
});

it('há um Gate para cada chave do catálogo', function () {
    foreach (PermissionKey::cases() as $key) {
        expect(Gate::has($key->value))->toBeTrue($key->value);
    }
});

it('os modelos dos 7 papéis existem e o administrador técnico só lê o diretório de usuários', function () {
    $templates = roleTemplates();

    expect(array_keys($templates))->toEqualCanonicalizing(ROLE_CODES)
        ->and($templates['ADMIN_TECNICO'])->toBe(['users.read']);
});

it('as permissões são aditivas: quem tem dois papéis recebe a união', function () {
    $user = userWithRole('PASTORAL');
    DB::statement(
        'INSERT IGNORE INTO user_permissions (user_id, role_code, permission_key)
         SELECT ?, role_code, permission_key FROM role_templates WHERE role_code = ?',
        [$user->getKey(), 'TESOURARIA'],
    );

    $this->actingAs($user)->withSession([EnforceSessionLimits::LOGIN_AT => time()])
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('data.roles', ['PASTORAL', 'TESOURARIA'])
        ->assertJsonPath('data.permissions', ['leads.oracao.read', 'leads.read', 'mensagens.write', 'pix.write', 'users.read']);

    expect(Gate::forUser($user)->allows('pix.write'))->toBeTrue()
        ->and(Gate::forUser($user)->allows('leads.manage'))->toBeFalse();
});

// ───────────────────────────── BR-075: escopo próprio ─────────────────────────────

it('BR-075 a permissão .own vale só com ministério vinculado e só para esse ministério', function () {
    $leader = userWithRole('LIDER_MINISTERIO');
    $other = MinistryGroup::factory()->create();
    $gate = Gate::forUser($leader);

    expect($gate->allows('eventos.write.own'))->toBeTrue()
        ->and($gate->allows('eventos.write.own', $leader->ministry_id))->toBeTrue()
        ->and($gate->allows('eventos.write.own', $other->getKey()))->toBeFalse()
        ->and($gate->allows('eventos.inscricoes.read.own', $leader->ministry_id))->toBeTrue()
        ->and($gate->allows('eventos.inscricoes.read.own', $other->getKey()))->toBeFalse()
        // .own não vira a permissão geral
        ->and($gate->allows('eventos.write'))->toBeFalse()
        ->and($gate->allows('eventos.inscricoes.read'))->toBeFalse();
});

it('BR-075 a permissão .own sem ministério vinculado não concede nada', function () {
    $leader = userWithRole('LIDER_MINISTERIO', ['ministry_id' => null]);
    $gate = Gate::forUser($leader);

    expect($gate->allows('eventos.write.own'))->toBeFalse()
        ->and($gate->allows('eventos.write.own', 1))->toBeFalse()
        ->and($gate->allows('eventos.inscricoes.read.own'))->toBeFalse();
});

it('BR-075 a permissão geral não depende do ministério', function () {
    $communication = userWithRole('COMUNICACAO');
    $gate = Gate::forUser($communication);

    expect($gate->allows('eventos.write'))->toBeTrue()
        ->and($gate->allows('eventos.write', 999))->toBeTrue();
});

it('carrega as permissões do usuário uma única vez por requisição', function () {
    $user = userWithRole('SECRETARIA');
    $gate = Gate::forUser($user);

    DB::enableQueryLog();
    foreach (['leads.read', 'leads.manage', 'settings.write', 'pix.write', 'users.read'] as $key) {
        $gate->allows($key);
    }
    $queries = collect(DB::getQueryLog())->filter(fn ($query) => str_contains($query['query'], 'user_permissions'));

    expect($queries)->toHaveCount(1);
});
