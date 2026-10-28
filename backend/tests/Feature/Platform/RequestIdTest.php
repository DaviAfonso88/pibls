<?php

declare(strict_types=1);

use App\Shared\Http\RequestId;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

use function Pest\Laravel\getJson;

/*
| Observability → Correlation ID: aceita um ULID válido de `X-Request-Id`, senão gera um; devolve no cabeçalho e
| propaga para o Context do Laravel (log, jobs) e para `error.traceId`.
*/

beforeEach(function () {
    Route::middleware('api')->get('/api/_request-id', fn (Request $r) => response()->json([
        'attribute' => $r->attributes->get(RequestId::ATTRIBUTE),
        'context' => Context::get(RequestId::CONTEXT_KEY),
        'current' => RequestId::current($r),
    ]));
});

it('gera um ULID quando a requisição não traz X-Request-Id', function () {
    $response = getJson('/api/_request-id');

    $id = $response->headers->get('X-Request-Id');
    expect($id)->toMatch('/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/')
        ->and($response->json())->toBe(['attribute' => $id, 'context' => $id, 'current' => $id]);
});

it('aceita o ULID válido enviado pela SPA e o devolve em maiúsculas', function () {
    $sent = strtolower((string) Str::ulid());

    $response = getJson('/api/_request-id', ['X-Request-Id' => $sent]);

    expect($response->headers->get('X-Request-Id'))->toBe(strtoupper($sent))
        ->and($response->json('context'))->toBe(strtoupper($sent));
});

it('descarta um X-Request-Id que não é ULID e gera outro', function (string $invalid) {
    $response = getJson('/api/_request-id', ['X-Request-Id' => $invalid]);

    $id = $response->headers->get('X-Request-Id');
    expect($id)->not->toBe($invalid)->and(RequestId::isValid($id))->toBeTrue();
})->with([
    'texto livre' => ['abc'],
    'injeção de cabeçalho' => ['01JC8Z3K7Q2W9V5T4N6M8B1X0Y, evil'],
    'tamanho errado' => ['01JC8Z3K7Q2W9V5T4N6M8B1X0'],
    'alfabeto inválido (I, L, O, U)' => ['01JC8Z3K7Q2W9V5T4N6M8B1XIL'],
    'primeiro caractere acima de 7 (estoura 128 bits)' => ['91JC8Z3K7Q2W9V5T4N6M8B1X0Y'],
]);

it('usa o mesmo id no cabeçalho e em error.traceId de uma resposta de erro', function () {
    $sent = (string) Str::ulid();

    $response = getJson('/api/nao-existe', ['X-Request-Id' => $sent]);

    $response->assertNotFound();
    expect($response->headers->get('X-Request-Id'))->toBe(strtoupper($sent))
        ->and($response->json('error.traceId'))->toBe(strtoupper($sent));
});

it('valida o formato do ULID', function () {
    expect(RequestId::isValid(null))->toBeFalse()
        ->and(RequestId::isValid(''))->toBeFalse()
        ->and(RequestId::isValid((string) Str::ulid()))->toBeTrue();
});
