<?php

declare(strict_types=1);

use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/*
| `php artisan pibls:hash-password` (T093): hash bcrypt de custo 12 para colar no phpMyAdmin (BR-077).
*/

const ASK_PASSWORD = 'Senha (mínimo de 12 caracteres, não aparece na tela)';
const ASK_CONFIRMATION = 'Repita a senha';

beforeEach(function () {
    Http::preventStrayRequests();
    Http::fake(['api.pwnedpasswords.com/*' => Http::response('', 200)]);
});

it('imprime só o hash bcrypt (custo 12), sem repetir a senha', function () {
    $password = 'uma-senha-longa-e-boa-123';

    $this->artisan('pibls:hash-password')
        ->expectsQuestion(ASK_PASSWORD, $password)
        ->expectsQuestion(ASK_CONFIRMATION, $password)
        ->expectsOutputToContain('$2y$12$')
        ->doesntExpectOutputToContain($password)
        ->assertSuccessful();
});

it('recusa quando as duas senhas diferem', function () {
    $this->artisan('pibls:hash-password')
        ->expectsQuestion(ASK_PASSWORD, 'uma-senha-longa-e-boa-123')
        ->expectsQuestion(ASK_CONFIRMATION, 'outra-senha-longa-e-boa')
        ->expectsOutputToContain('As duas senhas não são iguais.')
        ->assertFailed();
});

it('BR-073 recusa senha fora da política, com a frase da regra', function (string $password, string $message) {
    $this->artisan('pibls:hash-password')
        ->expectsQuestion(ASK_PASSWORD, $password)
        ->expectsQuestion(ASK_CONFIRMATION, $password)
        ->expectsOutputToContain($message)
        ->assertFailed();
})->with([
    'curta' => ['curta-demai', 'A senha precisa ter pelo menos 12 caracteres.'],
    'longa' => [str_repeat('a', 73), 'A senha é longa demais.'],
]);

it('BR-073 recusa senha vazada', function () {
    $password = 'uma-senha-longa-e-boa-123';
    Http::swap(new Factory);
    Http::fake(['api.pwnedpasswords.com/*' => Http::response(strtoupper(substr(sha1($password), 5)).':500', 200)]);

    $this->artisan('pibls:hash-password')
        ->expectsQuestion(ASK_PASSWORD, $password)
        ->expectsQuestion(ASK_CONFIRMATION, $password)
        ->expectsOutputToContain('Esta senha apareceu em vazamentos de dados. Escolha outra.')
        ->assertFailed();
});

it('sem internet o hash sai mesmo assim (fail-open), com aviso no log', function () {
    Log::spy();
    Http::swap(new Factory);
    Http::fake(['api.pwnedpasswords.com/*' => Http::response('', 500)]);
    $password = 'uma-senha-longa-e-boa-123';

    $this->artisan('pibls:hash-password')
        ->expectsQuestion(ASK_PASSWORD, $password)
        ->expectsQuestion(ASK_CONFIRMATION, $password)
        ->expectsOutputToContain('$2y$12$')
        ->assertSuccessful();

    Log::shouldHaveReceived('warning')->withArgs(fn (string $message) => $message === 'password.hibp_unavailable')->once();
});

it('o hash de custo 12 é aceito pelo Hash do Laravel', function () {
    $hash = Hash::driver('bcrypt')->make('uma-senha-longa-e-boa-123', ['rounds' => 12]);

    expect(Hash::check('uma-senha-longa-e-boa-123', $hash))->toBeTrue()
        ->and(password_get_info($hash)['options']['cost'])->toBe(12);
});
