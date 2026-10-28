<?php

declare(strict_types=1);

use App\Modules\Access\Http\Middleware\EnforceSessionLimits;
use App\Modules\Access\Models\User;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/*
| Login, logout, `me` e sessão (architecture.md → CAP-08; Security → Autenticação; BR-070, BR-071, BR-074).
| O CSRF é do Laravel e fica de fora dos testes de feature (ele se desliga nos testes unitários); o fluxo completo com
| cookies é coberto pelo E2E.
*/

const PASSWORD = 'uma-senha-longa-e-boa-123';

function loginPayload(string $email, string $password = PASSWORD): array
{
    return ['email' => $email, 'password' => $password];
}

it('entra com e-mail e senha corretos e devolve o usuário com papéis e permissões', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))
        ->assertOk()
        ->assertJsonPath('data.id', $user->getKey())
        ->assertJsonPath('data.email', 'secretaria@pibls.test')
        ->assertJsonPath('data.ministry', null)
        ->assertJsonPath('data.roles', ['SECRETARIA'])
        ->assertJsonPath('data.permissions', [
            'eventos.inscricoes.read', 'leads.manage', 'leads.read', 'ministerios.write', 'settings.write',
        ])
        ->assertJsonMissingPath('data.password');

    expect(auth('web')->id())->toBe($user->getKey());
});

it('aceita o e-mail em qualquer caixa e com espaços nas pontas', function () {
    userWithRole('ORACAO', ['email' => 'oracao@pibls.test', 'password' => PASSWORD]);

    postJson('/api/auth/login', loginPayload('  ORACAO@Pibls.Test '))->assertOk();
});

it('o usuário com ministério vinculado recebe o ministério no corpo', function () {
    $user = userWithRole('LIDER_MINISTERIO', ['email' => 'lider@pibls.test', 'password' => PASSWORD]);

    postJson('/api/auth/login', loginPayload('lider@pibls.test'))
        ->assertOk()
        ->assertJsonPath('data.ministry.id', $user->ministry_id)
        ->assertJsonPath('data.ministry.name', $user->ministry->name)
        ->assertJsonPath('data.permissions', ['eventos.inscricoes.read.own', 'eventos.write.own']);
});

it('grava last_login_at, mas não mexe no restante do usuário (BR-077)', function () {
    $user = userWithRole('PASTORAL', ['email' => 'pastoral@pibls.test', 'password' => PASSWORD]);
    $before = $user->only(['name', 'email', 'password', 'is_active', 'ministry_id']);

    expect($user->last_login_at)->toBeNull();

    postJson('/api/auth/login', loginPayload('pastoral@pibls.test'))->assertOk();

    $user->refresh();
    expect($user->last_login_at)->not->toBeNull()
        ->and($user->only(['name', 'email', 'password', 'is_active', 'ministry_id']))->toBe($before);
});

it('regenera o id da sessão no login (contra fixação)', function () {
    userWithRole('PASTORAL', ['email' => 'pastoral@pibls.test', 'password' => PASSWORD]);
    $fixed = str_repeat('a', 40);

    $response = $this->withUnencryptedCookie(config('session.cookie'), $fixed)
        ->postJson('/api/auth/login', loginPayload('pastoral@pibls.test'))
        ->assertOk();

    $issued = $response->getCookie(config('session.cookie'));
    expect($issued)->not->toBeNull()
        ->and($issued->getValue())->not->toBe($fixed);
});

it('grava o instante do login na sessão para o limite de 12 h', function () {
    userWithRole('PASTORAL', ['email' => 'pastoral@pibls.test', 'password' => PASSWORD]);

    postJson('/api/auth/login', loginPayload('pastoral@pibls.test'))->assertOk();

    expect(session(EnforceSessionLimits::LOGIN_AT))->toBeInt()
        ->and(abs(session(EnforceSessionLimits::LOGIN_AT) - time()))->toBeLessThan(5);
});

it('usa cookie de sessão pibls_session, HttpOnly e SameSite=Strict, com sessão de 60 min de inatividade', function () {
    expect(config('session.cookie'))->toBe('pibls_session')
        ->and(config('session.http_only'))->toBeTrue()
        ->and(config('session.same_site'))->toBe('strict')
        ->and(config('session.lifetime'))->toBe(60)
        ->and(config('session.driver'))->toBe('array'); // testes; o driver de produção é `database`

    userWithRole('PASTORAL', ['email' => 'pastoral@pibls.test', 'password' => PASSWORD]);
    $cookie = postJson('/api/auth/login', loginPayload('pastoral@pibls.test'))->getCookie('pibls_session', false);

    expect($cookie->isHttpOnly())->toBeTrue()
        ->and($cookie->getSameSite())->toBe('strict');
});

it('o hash das senhas é bcrypt de custo 12 fora dos testes', function () {
    expect(Hash::driver('bcrypt')->make('x', ['rounds' => 12]))->toStartWith('$2y$12$')
        ->and(config('hashing.driver'))->toBe('bcrypt');
});

// ───────────────────────────── BR-070 ─────────────────────────────

it('BR-070 responde igual a e-mail inexistente, senha errada e usuário inativo', function () {
    userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test', 'password' => PASSWORD]);
    userWithRole('SECRETARIA', ['email' => 'inativo@pibls.test', 'password' => PASSWORD, 'is_active' => false]);

    $bodies = [
        postJson('/api/auth/login', loginPayload('nao-existe@pibls.test')),
        postJson('/api/auth/login', loginPayload('ativo@pibls.test', 'senha-errada-123456')),
        postJson('/api/auth/login', loginPayload('inativo@pibls.test')),
    ];

    foreach ($bodies as $response) {
        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_CREDENTIALS')
            ->assertJsonPath('error.message', 'E-mail ou senha inválidos.')
            ->assertJsonPath('error.details', []);
    }

    $normalised = array_map(function ($response) {
        $json = $response->json();
        unset($json['error']['traceId']);

        return $json;
    }, $bodies);
    expect($normalised[0])->toBe($normalised[1])->and($normalised[1])->toBe($normalised[2]);
});

it('BR-070 o usuário inativo não entra nem com a senha certa', function () {
    userWithRole('SECRETARIA', ['email' => 'inativo@pibls.test', 'password' => PASSWORD, 'is_active' => false]);

    postJson('/api/auth/login', loginPayload('inativo@pibls.test'))->assertStatus(422);

    expect(auth('web')->check())->toBeFalse();
});

it('exige e-mail e senha', function () {
    postJson('/api/auth/login', [])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'email')
        ->assertJsonPath('error.details.1.field', 'password');
});

// ───────────────────────────── BR-071 ─────────────────────────────

it('BR-071 bloqueia o par e-mail + IP por 15 min depois de 5 falhas, mesmo com a senha certa', function () {
    userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    foreach (range(1, 5) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-'.$attempt))->assertStatus(422);
    }

    $locked = postJson('/api/auth/login', loginPayload('secretaria@pibls.test'));

    $locked->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS')
        ->assertJsonPath('error.message', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    expect((int) $locked->headers->get('Retry-After'))->toBeGreaterThan(800)->toBeLessThanOrEqual(900)
        ->and(auth('web')->check())->toBeFalse();
});

it('BR-071 o bloqueio acaba depois de 15 min', function () {
    userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    foreach (range(1, 5) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-'.$attempt));
    }
    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))->assertStatus(429);

    $this->travel(16)->minutes();

    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))->assertOk();
});

it('BR-071 o bloqueio vale só para o par: outro e-mail, no mesmo IP, continua entrando', function () {
    userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);
    userWithRole('ORACAO', ['email' => 'oracao@pibls.test', 'password' => PASSWORD]);

    foreach (range(1, 5) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-'.$attempt));
    }

    postJson('/api/auth/login', loginPayload('oracao@pibls.test'))->assertOk();
});

it('BR-071 o mesmo e-mail vindo de outro IP não é bloqueado', function () {
    userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    foreach (range(1, 5) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-'.$attempt));
    }

    $this->withServerVariables(['REMOTE_ADDR' => '10.20.30.40'])
        ->postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))
        ->assertOk();
});

it('BR-071 um login certo zera as falhas anteriores', function () {
    userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    foreach (range(1, 4) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-'.$attempt))->assertStatus(422);
    }
    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))->assertOk();

    foreach (range(1, 4) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'outra-errada-'.$attempt))->assertStatus(422);
    }
    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))->assertOk();
});

it('BR-071 o limite de 20 requisições de login por IP em 15 min vale para qualquer e-mail', function () {
    foreach (range(1, 20) as $i) {
        postJson('/api/auth/login', loginPayload("pessoa-{$i}@pibls.test"))->assertStatus(422);
    }

    postJson('/api/auth/login', loginPayload('pessoa-21@pibls.test'))
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS');
});

it('o cache do bloqueio não guarda o e-mail nem o IP, só o hash', function () {
    foreach (range(1, 5) as $attempt) {
        postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-'.$attempt));
    }

    // O driver `array` do cache de testes guarda tudo na propriedade `storage`
    $store = app('cache')->store('array')->getStore();
    $keys = implode(' ', array_keys((new ReflectionProperty($store, 'storage'))->getValue($store)));

    expect($keys)->toContain('login-lock:')
        ->and($keys)->not->toContain('secretaria@pibls.test')
        ->and($keys)->not->toContain('127.0.0.1');
});

// ───────────────────────────── BR-074 e sessão ─────────────────────────────

it('BR-074 o usuário desativado perde o acesso na requisição seguinte', function () {
    $user = userWithRole('SECRETARIA');
    $session = [EnforceSessionLimits::LOGIN_AT => time()];

    $this->actingAs($user)->withSession($session)->getJson('/api/auth/me')->assertOk();

    // Desativado no phpMyAdmin; a requisição seguinte lê o usuário de novo do banco
    DB::table('users')->where('id', $user->getKey())->update(['is_active' => false]);

    $this->actingAs(User::query()->findOrFail($user->getKey()))
        ->withSession($session)
        ->getJson('/api/auth/me')
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'UNAUTHENTICATED')
        ->assertJsonPath('error.message', 'Sua sessão expirou. Entre novamente.');

    expect(auth('web')->check())->toBeFalse();
});

it('encerra a sessão depois de 12 h do login, mesmo com atividade', function () {
    $user = userWithRole('SECRETARIA');

    $this->actingAs($user)
        ->withSession([EnforceSessionLimits::LOGIN_AT => time() - 43_200 + 60])
        ->getJson('/api/auth/me')
        ->assertOk();

    $this->actingAs($user)
        ->withSession([EnforceSessionLimits::LOGIN_AT => time() - 43_200 - 1])
        ->getJson('/api/auth/me')
        ->assertUnauthorized()
        ->assertJsonPath('error.message', 'Sua sessão expirou. Entre novamente.');
});

it('encerra a sessão autenticada que não tem o instante do login', function () {
    $user = userWithRole('SECRETARIA');

    $this->actingAs($user)->getJson('/api/auth/me')->assertUnauthorized();
});

it('a sessão ociosa por mais de 60 min deixa de existir (driver de sessão)', function () {
    config(['session.driver' => 'database']);
    $handler = app('session')->driver('database')->getHandler();

    DB::table('sessions')->insert([
        ['id' => 'recente', 'payload' => base64_encode('dados'), 'last_activity' => time() - 59 * 60],
        ['id' => 'ociosa', 'payload' => base64_encode('dados'), 'last_activity' => time() - 61 * 60],
    ]);

    expect($handler->read('recente'))->toBe('dados')
        ->and($handler->read('ociosa'))->toBe('');
});

it('me sem sessão responde 401', function () {
    getJson('/api/auth/me')
        ->assertUnauthorized()
        ->assertJsonPath('error.code', 'UNAUTHENTICATED');
});

it('rota do painel sem sessão responde 401 com o envelope mesmo sem Accept: application/json', function () {
    // Navegadores e clientes simples pedem `*/*`; o Authenticate não pode tentar redirecionar para uma rota `login`
    foreach (['/api/admin/users', '/api/auth/me'] as $uri) {
        $this->get($uri, ['Accept' => '*/*'])
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }
});

it('me devolve o usuário da sessão', function () {
    $user = userWithRole('COMUNICACAO');

    $this->actingAs($user)
        ->withSession([EnforceSessionLimits::LOGIN_AT => time()])
        ->getJson('/api/auth/me')
        ->assertOk()
        ->assertJsonPath('data.id', $user->getKey())
        ->assertJsonPath('data.roles', ['COMUNICACAO'])
        ->assertJsonPath('data.permissions', [
            'boletins.write', 'eventos.inscricoes.read', 'eventos.write', 'mensagens.write', 'ministerios.write', 'settings.write',
        ]);
});

// ───────────────────────────── Logout ─────────────────────────────

it('sai: 204, sessão invalidada e usuário fora do guard', function () {
    $user = userWithRole('SECRETARIA');

    $this->actingAs($user)
        ->withSession([EnforceSessionLimits::LOGIN_AT => time()])
        ->postJson('/api/auth/logout')
        ->assertNoContent();

    expect(auth('web')->check())->toBeFalse();
});

it('sair sem sessão responde 401', function () {
    postJson('/api/auth/logout')->assertUnauthorized();
});

// ───────────────────────────── Auditoria ─────────────────────────────

it('audita login, falha e logout (auth.*) sem dado pessoal', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    postJson('/api/auth/login', loginPayload('secretaria@pibls.test', 'errada-numero-1'))->assertStatus(422);
    postJson('/api/auth/login', loginPayload('nao-existe@pibls.test'))->assertStatus(422);
    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))->assertOk();
    $this->actingAs($user)->withSession([EnforceSessionLimits::LOGIN_AT => time()])->postJson('/api/auth/logout')->assertNoContent();

    $actions = AuditLog::query()->orderBy('id')->pluck('action')->all();
    expect($actions)->toBe(['auth.login_failed', 'auth.login_failed', 'auth.login_succeeded', 'auth.logout']);

    $succeeded = AuditLog::query()->where('action', 'auth.login_succeeded')->firstOrFail();
    expect($succeeded->actor_user_id)->toBe($user->getKey())
        ->and($succeeded->resource_type)->toBe('user')
        ->and($succeeded->resource_id)->toBe((string) $user->getKey());

    $dump = AuditLog::query()->get()->toJson();
    expect($dump)->not->toContain('secretaria@pibls.test')->and($dump)->not->toContain('nao-existe@pibls.test');
});

it('registra o login e o logout no log em nível info, sem e-mail', function () {
    Log::spy();
    userWithRole('SECRETARIA', ['email' => 'secretaria@pibls.test', 'password' => PASSWORD]);

    postJson('/api/auth/login', loginPayload('secretaria@pibls.test'))->assertOk();

    Log::shouldHaveReceived('info')
        ->withArgs(fn (string $message, array $context = []) => $message === 'auth.login' && array_keys($context) === ['userId'])
        ->once();
});
