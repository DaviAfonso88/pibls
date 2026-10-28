<?php

declare(strict_types=1);

use App\Modules\Ministries\Models\MinistryGroup;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Database\QueryException;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Route;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/*
| API Standards → Formato padrão de erro e Status codes; Error Handling Strategy.
| As rotas abaixo existem só nestes testes, no grupo `api`, para provocar cada categoria de erro.
*/

beforeEach(function () {
    Route::middleware('api')->prefix('api/_erros')->group(function () {
        Route::post('/validacao', fn (Request $r) => $r->validate([
            'phone' => ['required', 'string'],
            'name' => ['required', 'min:2'],
        ]));
        Route::get('/regra', fn () => throw new BusinessRuleException('EVENT_FULL', 'Vagas esgotadas para este evento.'));
        Route::get('/auth', fn () => 'ok')->middleware('auth:web');
        Route::get('/proibido', fn () => abort(403));
        Route::get('/model', fn () => MinistryGroup::query()->findOrFail(987654));
        Route::get('/csrf', fn () => throw new TokenMismatchException);
        Route::get('/grande', fn () => throw new PostTooLargeException);
        Route::get('/limite', fn () => 'ok')->middleware('throttle:1,1');
        Route::get('/inesperado', fn () => throw new RuntimeException('segredo interno: senha=hunter2'));
        Route::get('/sem-banco', function () {
            $driver = new PDOException('SQLSTATE[HY000] [2002] Connection refused');
            $driver->errorInfo = ['HY000', 2002, 'Connection refused'];
            throw new QueryException('mysql', 'select 1', [], $driver);
        });
    });
});

it('devolve 404 NOT_FOUND no envelope para rota de API inexistente', function () {
    $response = getJson('/api/nao-existe');

    $response->assertNotFound();
    expect($response->headers->get('Cache-Control'))->toContain('no-store');
    $error = $response->json('error');
    expect($error)->toHaveKeys(['code', 'message', 'details', 'traceId'])
        ->and($error['code'])->toBe('NOT_FOUND')
        ->and($error['message'])->toBe('Não encontramos o que você procurou.')
        ->and($error['details'])->toBe([])
        ->and($error['traceId'])->toMatch('/^[0-9A-HJKMNP-TV-Z]{26}$/')
        ->and($response->headers->get('X-Request-Id'))->toBe($error['traceId']);
});

it('devolve o envelope mesmo sem o cabeçalho Accept: application/json em rota /api', function () {
    $this->get('/api/nao-existe')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
});

it('devolve 405 METHOD_NOT_ALLOWED quando o método não existe na rota', function () {
    postJson('/api/health')->assertStatus(405)->assertJsonPath('error.code', 'METHOD_NOT_ALLOWED');
});

it('devolve 422 VALIDATION_ERROR com um item por campo e regra violada', function () {
    $response = postJson('/api/_erros/validacao', ['name' => 'A']);

    $response->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.message', 'Confira os campos destacados.');

    $details = collect($response->json('error.details'));
    expect($details->pluck('field')->all())->toContain('phone', 'name')
        ->and($details->firstWhere('field', 'phone'))->toMatchArray(['field' => 'phone', 'code' => 'required'])
        ->and($details->firstWhere('field', 'name')['code'])->toBe('min')
        ->and($details->firstWhere('field', 'phone')['message'])->toBeString()->not->toBeEmpty();
});

it('devolve 409 com o código específico da regra de negócio', function () {
    getJson('/api/_erros/regra')->assertStatus(409)
        ->assertJsonPath('error.code', 'EVENT_FULL')
        ->assertJsonPath('error.message', 'Vagas esgotadas para este evento.');
});

it('devolve 401 UNAUTHENTICATED para quem não tem sessão', function () {
    getJson('/api/_erros/auth')->assertUnauthorized()
        ->assertJsonPath('error.code', 'UNAUTHENTICATED')
        ->assertJsonPath('error.message', 'Sua sessão expirou. Entre novamente.');
});

it('devolve 403 FORBIDDEN', function () {
    getJson('/api/_erros/proibido')->assertForbidden()
        ->assertJsonPath('error.code', 'FORBIDDEN')
        ->assertJsonPath('error.message', 'Você não tem permissão para esta ação.');
});

it('devolve 404 NOT_FOUND quando o registro não existe', function () {
    getJson('/api/_erros/model')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
});

it('devolve 419 CSRF_TOKEN_MISMATCH', function () {
    getJson('/api/_erros/csrf')->assertStatus(419)->assertJsonPath('error.code', 'CSRF_TOKEN_MISMATCH');
});

it('devolve 413 PAYLOAD_TOO_LARGE', function () {
    getJson('/api/_erros/grande')->assertStatus(413)->assertJsonPath('error.code', 'PAYLOAD_TOO_LARGE');
});

it('devolve 429 TOO_MANY_REQUESTS preservando Retry-After e X-RateLimit-*', function () {
    getJson('/api/_erros/limite')->assertOk();
    $response = getJson('/api/_erros/limite');

    $response->assertStatus(429)->assertJsonPath('error.code', 'TOO_MANY_REQUESTS')
        ->assertJsonPath('error.message', 'Muitas tentativas. Tente novamente em alguns minutos.')
        ->assertHeader('X-RateLimit-Limit', '1')
        ->assertHeader('X-RateLimit-Remaining', '0');
    expect((int) $response->headers->get('Retry-After'))->toBeGreaterThan(0);
});

it('devolve 500 INTERNAL_ERROR sem vazar a mensagem da exceção e com o código do erro', function () {
    $response = getJson('/api/_erros/inesperado');

    $response->assertStatus(500)->assertJsonPath('error.code', 'INTERNAL_ERROR');
    $traceId = $response->json('error.traceId');
    expect($response->json('error.message'))->toBe("Algo deu errado do nosso lado. Tente novamente em instantes. Código do erro: {$traceId}")
        ->and($response->getContent())->not->toContain('hunter2')->not->toContain('segredo interno');
});

it('devolve 503 SERVICE_UNAVAILABLE quando o banco está indisponível', function () {
    getJson('/api/_erros/sem-banco')->assertStatus(503)
        ->assertJsonPath('error.code', 'SERVICE_UNAVAILABLE')
        ->assertJsonPath('error.message', 'O site está com instabilidade. Tente novamente em instantes ou fale conosco pelo WhatsApp.');
});

it('mantém a página de erro padrão do Laravel fora da API', function () {
    $response = $this->get('/pagina-que-nao-existe');

    $response->assertNotFound();
    expect($response->headers->get('Content-Type'))->toContain('text/html')
        ->and($response->getContent())->not->toContain('"error"');
});
