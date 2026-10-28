<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

use function Pest\Laravel\getJson;

/*
| API Standards → Documentação: OpenAPI 3.1 gerado pelo Scramble e versionado em docs/openapi.json. Os tipos do
| frontend saem desse arquivo (T049) e o CI falha se o export divergir do versionado.
*/

function exportOpenApi(): array
{
    $path = sys_get_temp_dir().'/pibls-openapi-'.bin2hex(random_bytes(4)).'.json';

    try {
        Artisan::call('scramble:export', ['--path' => $path]);

        return json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
    } finally {
        File::delete($path);
    }
}

it('exporta um documento OpenAPI 3.1 com as rotas da API', function () {
    $document = exportOpenApi();

    expect($document['openapi'])->toStartWith('3.1')
        ->and($document['info']['title'])->toBe('Portal PIBLS — API')
        ->and($document['paths'])->toHaveKey('/health')
        ->and($document['paths']['/health'])->toHaveKey('get');
});

it('declara o servidor como caminho relativo, igual em qualquer ambiente', function () {
    config(['app.url' => 'http://outra-maquina.test']);

    expect(exportOpenApi()['servers'])->toBe([['url' => '/api', 'description' => 'Mesma origem']]);
});

it('o docs/openapi.json versionado é o que o código gera hoje', function () {
    $versioned = base_path('../docs/openapi.json');
    if (! is_file($versioned)) {
        $this->markTestSkipped('docs/openapi.json não está montado neste ambiente.');
    }

    expect(json_decode((string) file_get_contents($versioned), true, flags: JSON_THROW_ON_ERROR))
        ->toBe(exportOpenApi(), 'O contrato mudou. Regenere: php artisan scramble:export --path=../docs/openapi.json');
});

it('não expõe a documentação interativa fora de local e homologação', function () {
    expect(config('pibls.api_docs_enabled'))->toBeFalse();

    getJson('/docs/api.json')->assertNotFound();
    $this->get('/docs/api')->assertNotFound();
});
