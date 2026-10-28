<?php

declare(strict_types=1);

use App\Modules\Access\Models\User;
use App\Modules\Platform\Mail\NoticeMail;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;

use function Pest\Laravel\postJson;

/*
| Redefinição de senha (architecture.md → CAP-08, RF-D06; BR-072, BR-073). O token é o do broker do Laravel, guardado como
| hash em `password_reset_tokens`; o link do e-mail leva o token no fragmento da URL.
*/

const OLD_PASSWORD = 'senha-antiga-bem-longa-1';
const NEW_PASSWORD = 'senha-nova-bem-longa-2';
const GENERIC_ANSWER = 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha.';

/**
 * A consulta à base de vazamentos nunca sai da máquina nos testes. Cada chamada troca a resposta anterior (o `Http::fake`
 * do Laravel mantém a primeira que casa, então o cliente é recriado). Vazio = "nenhuma senha vazada".
 */
function fakeHibp(string|Closure $response = '', int $status = 200): void
{
    Http::swap(new Factory);
    Http::preventStrayRequests();
    Http::fake(['api.pwnedpasswords.com/*' => $response instanceof Closure ? $response : Http::response($response, $status)]);
}

beforeEach(function () {
    Mail::fake();
    fakeHibp();
});

/** @return array<string, mixed> */
function resetBody(string $email, string $token, string $password = NEW_PASSWORD, ?string $confirmation = null): array
{
    return [
        'email' => $email,
        'token' => $token,
        'password' => $password,
        'password_confirmation' => $confirmation ?? $password,
    ];
}

function resetToken(User $user): string
{
    return Password::broker()->createToken($user);
}

// ───────────────────────────── Pedir o link ─────────────────────────────

it('responde sempre a mesma frase, exista o e-mail ou não, e esteja o usuário ativo ou não', function () {
    userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    userWithRole('SECRETARIA', ['email' => 'inativo@pibls.test', 'is_active' => false]);

    $answers = collect(['ativo@pibls.test', 'inativo@pibls.test', 'nao-existe@pibls.test'])
        ->map(function (string $email) {
            $response = postJson('/api/auth/forgot-password', ['email' => $email])->assertOk();
            $json = $response->json();

            return $json;
        });

    expect($answers->unique()->count())->toBe(1)
        ->and($answers->first())->toBe(['data' => ['message' => GENERIC_ANSWER]]);
});

it('só o usuário ativo recebe o e-mail, pela fila, com o link e o token no fragmento', function () {
    userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    userWithRole('SECRETARIA', ['email' => 'inativo@pibls.test', 'is_active' => false]);

    foreach (['ativo@pibls.test', 'inativo@pibls.test', 'nao-existe@pibls.test'] as $email) {
        postJson('/api/auth/forgot-password', ['email' => $email])->assertOk();
    }

    Mail::assertQueuedCount(1);
    Mail::assertQueued(NoticeMail::class, fn (NoticeMail $mail) => $mail->hasTo('ativo@pibls.test'));
    Mail::assertNothingSent();

    $rendered = Mail::queued(NoticeMail::class)->first()->render();
    expect($rendered)->toContain('/admin/redefinir-senha#token=')->and($rendered)->toContain('email=ativo%40pibls.test');
});

it('o e-mail em texto puro leva o link inteiro, sem escapar o & (senão o e-mail do link se perde)', function () {
    $text = view('mail.notice.text', [
        'heading' => 'Crie uma nova senha',
        'lines' => ["Não foi você? Fale com o 'administrador'."],
        'actionLabel' => 'Criar nova senha',
        'actionUrl' => 'https://pibls.test/admin/redefinir-senha#token=abc%2B123&email=ana%40pibls.test',
    ])->render();

    expect($text)->toContain('#token=abc%2B123&email=ana%40pibls.test')
        ->and($text)->not->toContain('&amp;')
        ->and($text)->toContain("Fale com o 'administrador'.");
});

it('BR-072 guarda só o hash do token e um por e-mail', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/forgot-password', ['email' => 'ativo@pibls.test'])->assertOk();
    postJson('/api/auth/forgot-password', ['email' => 'ativo@pibls.test'])->assertOk();

    $rows = DB::table('password_reset_tokens')->get();
    expect($rows)->toHaveCount(1)
        ->and($rows->first()->email)->toBe($user->email)
        ->and(strlen($rows->first()->token))->toBe(60); // bcrypt

    preg_match('/token=([^&"\s]+)/', Mail::queued(NoticeMail::class)->last()->render(), $match);
    expect(Hash::check(urldecode($match[1]), $rows->first()->token))->toBeTrue();
});

it('audita o pedido sem o e-mail', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/forgot-password', ['email' => 'ativo@pibls.test'])->assertOk();

    $log = AuditLog::query()->where('action', 'auth.password_reset_requested')->firstOrFail();
    expect($log->resource_id)->toBe((string) $user->getKey())
        ->and($log->toJson())->not->toContain('ativo@pibls.test');
});

it('limita os pedidos: 3 por hora por e-mail e 10 por hora por IP', function () {
    foreach (range(1, 3) as $i) {
        postJson('/api/auth/forgot-password', ['email' => 'mesmo@pibls.test'])->assertOk();
    }
    postJson('/api/auth/forgot-password', ['email' => 'mesmo@pibls.test'])
        ->assertStatus(429)
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS');

    // Outro e-mail ainda passa, até o IP chegar a 10 pedidos
    foreach (range(1, 7) as $i) {
        postJson('/api/auth/forgot-password', ['email' => "pessoa-{$i}@pibls.test"])->assertOk();
    }
    postJson('/api/auth/forgot-password', ['email' => 'pessoa-8@pibls.test'])->assertStatus(429);
});

it('recusa e-mail malformado', function () {
    postJson('/api/auth/forgot-password', ['email' => 'isto-nao-e-email'])
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'email');
});

// ───────────────────────────── Redefinir ─────────────────────────────

it('troca a senha com o token do link, grava as datas e deixa entrar com a nova', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test', 'password' => OLD_PASSWORD]);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    $user->refresh();
    expect(Hash::check(NEW_PASSWORD, $user->password))->toBeTrue()
        ->and(Hash::check(OLD_PASSWORD, $user->password))->toBeFalse()
        ->and($user->password_changed_at)->not->toBeNull();

    postJson('/api/auth/login', ['email' => 'ativo@pibls.test', 'password' => NEW_PASSWORD])->assertOk();
});

it('BR-072 o token é de uso único', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $token = resetToken($user);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', $token))->assertOk();

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', $token, 'outra-senha-bem-longa-3'))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'INVALID_RESET_TOKEN')
        ->assertJsonPath('error.message', 'Link inválido ou expirado. Solicite um novo.');
    expect(DB::table('password_reset_tokens')->count())->toBe(0);
});

it('BR-072 o token vale 60 minutos', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $token = resetToken($user);

    $this->travel(61)->minutes();

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', $token))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'INVALID_RESET_TOKEN');
});

it('BR-072 o token ainda vale aos 59 minutos', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $token = resetToken($user);

    $this->travel(59)->minutes();

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', $token))->assertOk();
});

it('BR-072 responde igual a token errado, e-mail desconhecido e usuário inativo', function () {
    $active = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $inactive = userWithRole('SECRETARIA', ['email' => 'inativo@pibls.test', 'is_active' => false]);
    $validToken = resetToken($active);
    $inactiveToken = resetToken($inactive);

    $answers = [
        postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', 'token-que-nao-existe')),
        postJson('/api/auth/reset-password', resetBody('nao-existe@pibls.test', $validToken)),
        postJson('/api/auth/reset-password', resetBody('inativo@pibls.test', $inactiveToken)),
        postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', $inactiveToken)),
    ];

    foreach ($answers as $response) {
        $response->assertStatus(422)->assertJsonPath('error.code', 'INVALID_RESET_TOKEN');
    }
    expect(Hash::check(NEW_PASSWORD, $inactive->refresh()->password))->toBeFalse();
});

it('apaga todas as sessões do usuário e só as dele', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $other = userWithRole('PASTORAL', ['email' => 'outro@pibls.test']);

    DB::table('sessions')->insert([
        ['id' => 's-1', 'user_id' => $user->getKey(), 'payload' => '', 'last_activity' => time()],
        ['id' => 's-2', 'user_id' => $user->getKey(), 'payload' => '', 'last_activity' => time()],
        ['id' => 's-3', 'user_id' => $other->getKey(), 'payload' => '', 'last_activity' => time()],
    ]);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    expect(DB::table('sessions')->pluck('id')->all())->toBe(['s-3']);
});

it('enfileira o aviso "Sua senha foi alterada" para o dono da conta', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    Mail::assertQueuedCount(1);
    Mail::assertQueued(NoticeMail::class, function (NoticeMail $mail) {
        return $mail->hasTo('ativo@pibls.test')
            && str_contains($mail->render(), 'Sua senha foi alterada')
            && ! str_contains($mail->render(), NEW_PASSWORD);
    });
});

it('audita a troca de senha sem a senha nem o e-mail', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    $log = AuditLog::query()->where('action', 'auth.password_changed')->firstOrFail();
    expect($log->actor_user_id)->toBe($user->getKey())
        ->and($log->toJson())->not->toContain(NEW_PASSWORD)
        ->and($log->toJson())->not->toContain('ativo@pibls.test');
});

it('o hash gravado é bcrypt', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    expect($user->refresh()->password)->toStartWith('$2y$');
});

it('limita a redefinição a 10 por hora por IP', function () {
    foreach (range(1, 10) as $i) {
        postJson('/api/auth/reset-password', resetBody("p{$i}@pibls.test", 'token'))->assertStatus(422);
    }

    postJson('/api/auth/reset-password', resetBody('p11@pibls.test', 'token'))->assertStatus(429);
});

// ───────────────────────────── BR-073: política de senha ─────────────────────────────

dataset('senhas fora da política', [
    'com 11 caracteres' => ['curta-demai', 'A senha precisa ter pelo menos 12 caracteres.'],
    'com 73 bytes' => [str_repeat('a', 73), 'A senha é longa demais.'],
    'com 37 letras acentuadas (74 bytes, 37 caracteres)' => [str_repeat('é', 37), 'A senha é longa demais.'],
]);

it('BR-073 recusa a senha fora da política, com a frase da regra, no campo password', function (string $password, string $message) {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test', 'password' => OLD_PASSWORD]);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user), $password))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'password')
        ->assertJsonPath('error.details.0.message', $message);

    expect(Hash::check(OLD_PASSWORD, $user->refresh()->password))->toBeTrue();
})->with('senhas fora da política');

it('BR-073 aceita 12 caracteres e 72 bytes, sem regra de composição', function (string $password) {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user), $password))->assertOk();
})->with([
    '12 caracteres, só letras' => 'abcdefghijkl',
    '72 bytes' => str_repeat('a', 72),
    '36 letras acentuadas (72 bytes)' => str_repeat('é', 36),
]);

it('BR-073 recusa a senha que aparece em vazamentos (Have I Been Pwned)', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $suffix = strtoupper(substr(sha1(NEW_PASSWORD), 5));
    fakeHibp("0123456789ABCDEF0123456789ABCDEF012:4\n{$suffix}:98765\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1");

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'password')
        ->assertJsonPath('error.details.0.message', 'Esta senha apareceu em vazamentos de dados. Escolha outra.');

    // Só o prefixo de 5 caracteres do SHA-1 sai do servidor (k-anonimato)
    Http::assertSent(fn ($request) => $request->url() === 'https://api.pwnedpasswords.com/range/'.strtoupper(substr(sha1(NEW_PASSWORD), 0, 5)));
});

it('BR-073 ignora as linhas de preenchimento (contagem 0) da resposta do HIBP', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $suffix = strtoupper(substr(sha1(NEW_PASSWORD), 5));
    fakeHibp("{$suffix}:0");

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();
});

it('BR-073 com o HIBP fora do ar, a senha passa e o aviso vai para o log (fail-open)', function (string $failure) {
    Log::spy();
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);
    $failure === 'timeout'
        ? fakeHibp(fn () => throw new ConnectionException('timeout'))
        : fakeHibp('', 503);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    Log::shouldHaveReceived('warning')
        ->withArgs(fn (string $message) => $message === 'password.hibp_unavailable')
        ->once();
})->with(['erro 503' => ['503'], 'tempo esgotado' => ['timeout']]);

it('BR-073 pede à API o preenchimento de respostas (Add-Padding), para o tamanho não denunciar a senha', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user)))->assertOk();

    Http::assertSent(fn ($request) => $request->hasHeader('Add-Padding', 'true'));
});

it('exige a confirmação igual à senha', function () {
    $user = userWithRole('SECRETARIA', ['email' => 'ativo@pibls.test']);

    postJson('/api/auth/reset-password', resetBody('ativo@pibls.test', resetToken($user), NEW_PASSWORD, 'senha-diferente-123'))
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'password');
});
