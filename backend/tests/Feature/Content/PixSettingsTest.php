<?php

declare(strict_types=1);

use App\Modules\Content\Mail\PixAlertMail;
use App\Modules\Content\Models\SiteSetting;
use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;

use function Pest\Laravel\getJson;
use function Pest\Laravel\post;

/*
| POST /api/admin/settings/pix (T123; CAP-18, contracts/openapi.yaml). BR-060 (reconfirmar a senha), BR-061 (CNPJ),
| BR-062 (CRC16 do Copia e Cola), BR-063 (destinatários do alerta no servidor), BR-045 (QR PNG ou JPEG até 1 MB).
*/

const PIX_PASSWORD = 'password'; // a senha que a UserFactory grava
const PIX_CNPJ = '11222333000181'; // CNPJ válido de exemplo

beforeEach(function () {
    Storage::fake('uploads');
    Mail::fake();
    config(['pibls.pix_alert_recipients' => ['pastor@example.com', 'tesouraria@example.com']]);
    $this->operator = asStaff('TESOURARIA', ['name' => 'Teresa Tesoureira']);
});

/** Um "Pix Copia e Cola" de exemplo, com os campos TLV e o CRC16 certos (o mesmo do teste dos objetos de valor). */
function validPixCode(): string
{
    return '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D';
}

function qrUpload(string $format = 'png', string $name = 'qr'): UploadedFile
{
    $image = imagecreatetruecolor(60, 60);
    imagefilledrectangle($image, 0, 0, 60, 60, imagecolorallocate($image, 20, 20, 20));
    ob_start();
    $format === 'png' ? imagepng($image) : imagejpeg($image);
    $bytes = (string) ob_get_clean();

    return UploadedFile::fake()->createWithContent("{$name}.{$format}", $bytes)->mimeType($format === 'png' ? 'image/png' : 'image/jpeg');
}

/** @param array<string, mixed> $overrides */
function pixFields(array $overrides = []): array
{
    return [
        'pix_key' => PIX_CNPJ,
        'beneficiary_name' => 'Igreja Batista de Teste',
        'current_password' => PIX_PASSWORD,
        ...$overrides,
    ];
}

/** POST multipart como o painel envia. */
function postPix(array $fields, ?UploadedFile $qr = null): TestResponse
{
    return test()->post('/api/admin/settings/pix', $qr === null ? $fields : [...$fields, 'qr_image' => $qr], ['Accept' => 'application/json']);
}

function storedPix(): array
{
    return SiteSetting::query()->findOrFail('pix')->value;
}

it('altera os dados, devolve o valor novo e o público passa a ver a mudança', function () {
    $response = postPix(pixFields(['copy_paste_code' => validPixCode()]), qrUpload())->assertOk();

    $response->assertJsonPath('data.pix_key', PIX_CNPJ)
        ->assertJsonPath('data.beneficiary_name', 'Igreja Batista de Teste')
        ->assertJsonPath('data.copy_paste_code', validPixCode());
    expect($response->json('data.qr_image_url'))->toMatch('#^/uploads/pix/\d{4}/[0-9a-f]{32}\.png$#');

    getJson('/api/public/settings')->assertOk()
        ->assertJsonPath('data.pix.pix_key', PIX_CNPJ)
        ->assertJsonPath('data.pix.beneficiary_name', 'Igreja Batista de Teste')
        ->assertJsonPath('data.pix.qr_image_url', $response->json('data.qr_image_url'));
    Storage::disk('uploads')->assertExists(substr((string) $response->json('data.qr_image_url'), strlen('/uploads/')));
});

it('aceita a chave com a máscara do CNPJ e guarda só os dígitos', function () {
    postPix(pixFields(['pix_key' => '11.222.333/0001-81']), qrUpload())->assertOk()->assertJsonPath('data.pix_key', PIX_CNPJ);

    expect(storedPix()['pix_key'])->toBe(PIX_CNPJ);
});

it('BR-060 senha errada não muda nada, responde 422 PASSWORD_CONFIRMATION_FAILED e não deixa rastro', function () {
    $before = storedPix();

    postPix(pixFields(['current_password' => 'senha-errada']), qrUpload())
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PASSWORD_CONFIRMATION_FAILED')
        ->assertJsonPath('error.message', 'Senha incorreta. Os dados PIX não foram alterados.')
        ->assertJsonPath('error.details.0.field', 'current_password');

    expect(storedPix())->toBe($before)
        ->and(AuditLog::query()->where('action', 'pix.updated')->count())->toBe(0)
        ->and(Storage::disk('uploads')->allFiles())->toBe([]);
    Mail::assertNothingQueued();
});

it('BR-060 a senha é conferida antes de tudo: com senha errada, um CNPJ inválido não é apontado', function () {
    postPix(pixFields(['current_password' => 'senha-errada', 'pix_key' => '123', 'copy_paste_code' => 'lixo']))
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'PASSWORD_CONFIRMATION_FAILED')
        ->assertJsonMissing(['field' => 'pix_key']);
});

it('BR-060 depois de 5 senhas erradas bloqueia por um tempo, mesmo com a senha certa', function () {
    RateLimiter::clear('pix-password:'.$this->operator->getKey());

    foreach (range(1, 5) as $_) {
        postPix(pixFields(['current_password' => 'senha-errada']))->assertStatus(422);
    }

    postPix(pixFields(), qrUpload())
        ->assertStatus(429)
        ->assertHeader('Retry-After')
        ->assertJsonPath('error.code', 'TOO_MANY_REQUESTS');
    expect(storedPix()['pix_key'])->not->toBe(PIX_CNPJ);
});

it('BR-060 a senha certa zera a contagem de erros', function () {
    RateLimiter::clear('pix-password:'.$this->operator->getKey());

    foreach (range(1, 4) as $_) {
        postPix(pixFields(['current_password' => 'senha-errada']))->assertStatus(422);
    }
    postPix(pixFields(), qrUpload())->assertOk();
    foreach (range(1, 4) as $_) {
        postPix(pixFields(['current_password' => 'senha-errada']))->assertStatus(422);
    }

    postPix(pixFields(['beneficiary_name' => 'Outro nome']))->assertOk();
});

it('BR-063 sem destinatários do alerta no servidor recusa com 409 e não muda nada', function (array $recipients) {
    config(['pibls.pix_alert_recipients' => $recipients]);
    $before = storedPix();

    postPix(pixFields(), qrUpload())
        ->assertStatus(409)
        ->assertJsonPath('error.code', 'PIX_ALERT_NOT_CONFIGURED')
        ->assertJsonPath('error.message', 'Alteração bloqueada: os destinatários do alerta de PIX não estão configurados no servidor. Fale com o administrador técnico.');

    expect(storedPix())->toBe($before)->and(Storage::disk('uploads')->allFiles())->toBe([]);
    Mail::assertNothingQueued();
})->with([
    'lista vazia' => [[]],
]);

it('BR-063 a senha vem antes: com senha errada e sem destinatários, responde a senha', function () {
    config(['pibls.pix_alert_recipients' => []]);

    postPix(pixFields(['current_password' => 'senha-errada']))->assertStatus(422)->assertJsonPath('error.code', 'PASSWORD_CONFIRMATION_FAILED');
});

it('BR-061 recusa uma chave que não é um CNPJ válido, com a mensagem da regra', function (string $key) {
    postPix(pixFields(['pix_key' => $key]), qrUpload())
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'VALIDATION_ERROR')
        ->assertJsonPath('error.details.0.field', 'pix_key')
        ->assertJsonPath('error.details.0.message', 'Informe um CNPJ válido.');

    expect(Storage::disk('uploads')->allFiles())->toBe([]);
})->with([
    'dígitos verificadores errados' => '11222333000182',
    'curto' => '1122233300018',
    'repetidos' => '11111111111111',
    'e-mail' => 'tesouraria@example.com',
    'telefone' => '31999998888',
    'texto' => 'chave-qualquer',
]);

it('BR-062 aceita o Copia e Cola com CRC16 válido e recusa o inválido', function () {
    postPix(pixFields(['copy_paste_code' => validPixCode()]), qrUpload())->assertOk();

    $broken = substr(validPixCode(), 0, -1).'0';
    postPix(pixFields(['copy_paste_code' => $broken]))
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'copy_paste_code')
        ->assertJsonPath('error.details.0.message', 'O código Pix Copia e Cola é inválido. Copie-o novamente do aplicativo do banco.');
});

it('BR-062 o Copia e Cola é opcional e vazio limpa o que havia', function () {
    postPix(pixFields(['copy_paste_code' => validPixCode()]), qrUpload())->assertOk();
    expect(storedPix()['copy_paste_code'])->toBe(validPixCode());

    postPix(pixFields(['copy_paste_code' => '']))->assertOk()->assertJsonPath('data.copy_paste_code', null);
    expect(storedPix()['copy_paste_code'])->toBeNull();
});

it('BR-045 aceita QR em PNG e em JPEG', function (string $format) {
    postPix(pixFields(), qrUpload($format))->assertOk();
})->with(['png', 'jpg']);

it('BR-045 recusa o que não é PNG ou JPEG, com a mensagem da regra', function () {
    $gif = UploadedFile::fake()->createWithContent('qr.gif', "GIF89a\x01\x00\x01\x00\x00\x00\x00;")->mimeType('image/gif');
    $text = UploadedFile::fake()->createWithContent('qr.png', 'isto é um texto, não uma imagem')->mimeType('image/png');
    $php = UploadedFile::fake()->createWithContent('qr.png', "<?php echo 'oi';")->mimeType('image/png');

    foreach ([$gif, $text, $php] as $file) {
        postPix(pixFields(), $file)
            ->assertStatus(422)
            ->assertJsonPath('error.details.0.field', 'qr_image')
            ->assertJsonPath('error.details.0.message', 'O QR Code precisa ser PNG ou JPEG, com até 1 MB.');
    }

    expect(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('BR-045 responde 413 para um QR acima de 1 MB', function () {
    postPix(pixFields(), UploadedFile::fake()->create('grande.png', 1025, 'image/png'))
        ->assertStatus(413)
        ->assertJsonPath('error.code', 'PAYLOAD_TOO_LARGE');
});

it('exige o QR Code na primeira vez e o mantém depois, quando não vem um novo', function () {
    postPix(pixFields())
        ->assertStatus(422)
        ->assertJsonPath('error.details.0.field', 'qr_image')
        ->assertJsonPath('error.details.0.message', 'Envie o QR Code do PIX.');

    $url = postPix(pixFields(), qrUpload())->assertOk()->json('data.qr_image_url');

    postPix(pixFields(['beneficiary_name' => 'Só o nome mudou']))
        ->assertOk()
        ->assertJsonPath('data.qr_image_url', $url)
        ->assertJsonPath('data.beneficiary_name', 'Só o nome mudou');
});

it('trocar o QR apaga o arquivo anterior do disco', function () {
    $first = postPix(pixFields(), qrUpload('png', 'um'))->assertOk()->json('data.qr_image_url');
    $second = postPix(pixFields(), qrUpload('jpg', 'dois'))->assertOk()->json('data.qr_image_url');

    $firstPath = substr((string) $first, strlen('/uploads/'));
    $secondPath = substr((string) $second, strlen('/uploads/'));
    expect($secondPath)->not->toBe($firstPath);
    Storage::disk('uploads')->assertMissing($firstPath);
    Storage::disk('uploads')->assertExists($secondPath);
});

it('valida a forma dos campos com 422', function (array $override, string $field) {
    postPix(pixFields($override), qrUpload())
        ->assertStatus(422)
        ->assertJsonFragment(['field' => $field]);
})->with([
    'sem senha' => [['current_password' => ''], 'current_password'],
    'sem favorecido' => [['beneficiary_name' => ''], 'beneficiary_name'],
    'favorecido comprido' => [['beneficiary_name' => str_repeat('a', 121)], 'beneficiary_name'],
    'sem chave' => [['pix_key' => ''], 'pix_key'],
    'Copia e Cola comprido' => [['copy_paste_code' => str_repeat('a', 513)], 'copy_paste_code'],
]);

it('audita com o valor anterior e o novo, o autor e os campos, sem o QR nem o Copia e Cola', function () {
    $before = storedPix();

    postPix(pixFields(['copy_paste_code' => validPixCode()]), qrUpload())->assertOk();

    $log = AuditLog::query()->where('action', 'pix.updated')->firstOrFail();
    expect($log->actor_user_id)->toBe($this->operator->getKey())
        ->and($log->resource_type)->toBe('site_setting')
        ->and($log->resource_id)->toBe('pix')
        ->and($log->changes['fields'])->toEqual(['pix_key', 'beneficiary_name', 'qr_image', 'copy_paste_code'])
        ->and($log->changes['before']['pix_key'])->toBe($before['pix_key'])
        ->and($log->changes['before']['beneficiary_name'])->toBe($before['beneficiary_name'])
        ->and($log->changes['before']['has_qr_image'])->toBeFalse()
        ->and($log->changes['after'])->toEqual([
            'pix_key' => PIX_CNPJ,
            'beneficiary_name' => 'Igreja Batista de Teste',
            'has_qr_image' => true,
            'has_copy_paste_code' => true,
        ]);
    expect(json_encode($log->changes))->not->toContain(validPixCode())->not->toContain('/uploads/')->not->toContain('current_password');
});

it('enfileira o alerta para cada destinatário do servidor, na mesma operação', function () {
    postPix(pixFields(['copy_paste_code' => validPixCode()]), qrUpload())->assertOk();

    Mail::assertQueued(PixAlertMail::class, 2);
    foreach (['pastor@example.com', 'tesouraria@example.com'] as $address) {
        Mail::assertQueued(PixAlertMail::class, fn (PixAlertMail $mail) => $mail->hasTo($address));
    }

    Mail::assertQueued(PixAlertMail::class, function (PixAlertMail $mail) {
        $html = $mail->render();

        return $mail->envelope()->subject === 'Atenção: os dados PIX do site foram alterados'
            && str_contains($html, 'Teresa Tesoureira')
            && str_contains($html, '11.222.333/0001-81')
            && str_contains($html, 'Igreja Batista de Teste')
            && str_contains($html, 'a chave, o nome do favorecido, o QR Code e o código Pix Copia e Cola')
            && ! str_contains($html, validPixCode())
            && str_contains($html, '/contribua');
    });
});

it('os destinatários do alerta não vêm do painel nem do corpo da requisição', function () {
    postPix(pixFields(['alert_recipients' => ['invasor@example.com'], 'pix_alert_recipients' => 'invasor@example.com']), qrUpload())->assertOk();

    Mail::assertNotQueued(PixAlertMail::class, fn (PixAlertMail $mail) => $mail->hasTo('invasor@example.com'));
    Mail::assertQueued(PixAlertMail::class, 2);
});

it('pede a regeneração do snapshot público das configurações', function () {
    Event::fake([PublicContentChanged::class]);

    postPix(pixFields(), qrUpload())->assertOk();

    Event::assertDispatched(PublicContentChanged::class, fn (PublicContentChanged $event) => $event->snapshots === ['settings']);
});

it('os mesmos dados e nenhum QR novo não gravam, não auditam e não alertam', function () {
    postPix(pixFields(), qrUpload())->assertOk();
    $audits = AuditLog::query()->where('action', 'pix.updated')->count();
    Mail::fake();

    postPix(pixFields())->assertOk()->assertJsonPath('data.pix_key', PIX_CNPJ);

    expect(AuditLog::query()->where('action', 'pix.updated')->count())->toBe($audits);
    Mail::assertNothingQueued();
});

it('uma falha na gravação desfaz tudo: dados, auditoria, fila e o QR novo no disco', function () {
    $before = storedPix();
    Mail::shouldReceive('to')->andThrow(new RuntimeException('fila indisponível'));

    $this->withoutExceptionHandling();
    expect(fn () => postPix(pixFields(), qrUpload()))->toThrow(RuntimeException::class);

    expect(storedPix())->toBe($before)
        ->and(AuditLog::query()->where('action', 'pix.updated')->count())->toBe(0)
        ->and(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('mostra o valor vigente e o histórico das alterações, sem os valores antigos', function () {
    postPix(pixFields(), qrUpload())->assertOk();
    postPix(pixFields(['beneficiary_name' => 'Segundo nome']))->assertOk();

    $response = getJson('/api/admin/settings/pix')->assertOk();

    $response->assertJsonPath('data.pix_key', PIX_CNPJ)->assertJsonPath('data.beneficiary_name', 'Segundo nome');
    expect($response->json('history'))->toHaveCount(2)
        ->and($response->json('history.0.fields'))->toBe(['beneficiary_name'])
        ->and($response->json('history.0.actor.name'))->toBe('Teresa Tesoureira')
        ->and($response->json('history.1.fields'))->toBe(['pix_key', 'beneficiary_name', 'qr_image'])
        ->and(json_encode($response->json('history')))->not->toContain('Igreja Batista de Teste');
});

it('BR-076 só a Tesouraria altera ou lê os dados PIX', function (string $role, int $status) {
    auth()->logout();
    asStaff($role);

    getJson('/api/admin/settings/pix')->assertStatus($status);
    postPix(pixFields(), qrUpload())->assertStatus($status === 200 ? 200 : $status);
})->with([
    'Tesouraria' => ['TESOURARIA', 200],
    'Comunicação' => ['COMUNICACAO', 403],
    'Secretaria' => ['SECRETARIA', 403],
    'Pastoral' => ['PASTORAL', 403],
    'Oração' => ['ORACAO', 403],
    'Líder de ministério' => ['LIDER_MINISTERIO', 403],
    'Administrador técnico' => ['ADMIN_TECNICO', 403],
]);

it('responde 401 sem sessão', function () {
    auth()->logout();
    test()->flushSession();

    post('/api/admin/settings/pix', pixFields(), ['Accept' => 'application/json'])->assertUnauthorized();
    getJson('/api/admin/settings/pix')->assertUnauthorized();
});
