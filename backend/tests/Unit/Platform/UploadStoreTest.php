<?php

declare(strict_types=1);

use App\Modules\Platform\Files\UploadKind;
use App\Modules\Platform\Files\UploadStore;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

uses(TestCase::class);

beforeEach(function () {
    Storage::fake('uploads');
});

function uploads(): UploadStore
{
    return app(UploadStore::class);
}

function pdfBytes(string $extra = ''): string
{
    return "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n{$extra}trailer\n<< /Root 1 0 R >>\n%%EOF\n";
}

function jpegBytes(int $width = 40, int $height = 30, string $extraAfter = ''): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefilledrectangle($image, 0, 0, $width, $height, imagecolorallocate($image, 30, 90, 160));
    ob_start();
    imagejpeg($image, null, 90);

    return (string) ob_get_clean().$extraAfter;
}

function pngBytes(int $width = 40, int $height = 30): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefilledrectangle($image, 0, 0, $width, $height, imagecolorallocate($image, 200, 20, 20));
    ob_start();
    imagepng($image);

    return (string) ob_get_clean();
}

function webpBytes(int $width = 40, int $height = 30): string
{
    $image = imagecreatetruecolor($width, $height);
    imagefilledrectangle($image, 0, 0, $width, $height, imagecolorallocate($image, 20, 160, 20));
    ob_start();
    imagewebp($image);

    return (string) ob_get_clean();
}

/** Insere um segmento APP1 "Exif" logo depois do SOI, como as câmeras e os celulares fazem. */
function withExif(string $jpeg, string $secret): string
{
    $payload = "Exif\0\0".$secret;
    $segment = "\xFF\xE1".pack('n', strlen($payload) + 2).$payload;

    return substr($jpeg, 0, 2).$segment.substr($jpeg, 2);
}

function upload(string $name, string $content, string $mime): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $content)->mimeType($mime);
}

/** @return array{0: int, 1: int} */
function dimensionsOf(string $path): array
{
    $size = getimagesizefromstring((string) Storage::disk('uploads')->get($path));

    return [$size[0], $size[1]];
}

it('BR-041 grava o PDF verdadeiro com nome aleatório de 32 hex em boletins/AAAA/', function () {
    $stored = uploads()->store(upload('boletim 12.pdf', pdfBytes(), 'application/pdf'), UploadKind::BulletinPdf, 'pdf');

    expect($stored->path)->toMatch('#^boletins/\d{4}/[0-9a-f]{32}\.pdf$#')
        ->and($stored->path)->toStartWith('boletins/'.now('UTC')->format('Y').'/')
        ->and($stored->variants)->toBe([])
        ->and($stored->sizeBytes)->toBe(strlen(pdfBytes()))
        ->and(Storage::disk('uploads')->get($stored->path))->toBe(pdfBytes());
});

it('não confia no nome nem na extensão enviados pelo cliente', function () {
    $stored = uploads()->store(upload('../../etc/passwd.php.pdf', pdfBytes(), 'text/plain'), UploadKind::BulletinPdf, 'pdf');

    expect($stored->path)->toMatch('#^boletins/\d{4}/[0-9a-f]{32}\.pdf$#')
        ->and(Storage::disk('uploads')->allFiles())->toBe([$stored->path]);
});

it('gera um nome diferente a cada envio', function () {
    $first = uploads()->store(upload('a.pdf', pdfBytes(), 'application/pdf'), UploadKind::BulletinPdf);
    $second = uploads()->store(upload('a.pdf', pdfBytes(), 'application/pdf'), UploadKind::BulletinPdf);

    expect($first->path)->not->toBe($second->path);
});

it('BR-041 recusa PDF falso: arquivo qualquer com nome .pdf e Content-Type de PDF', function (string $content) {
    $attempt = fn () => uploads()->store(upload('boletim.pdf', $content, 'application/pdf'), UploadKind::BulletinPdf, 'pdf');

    expect($attempt)->toThrow(ValidationException::class);
    try {
        $attempt();
    } catch (ValidationException $e) {
        expect($e->errors())->toBe(['pdf' => ['O arquivo precisa ser um PDF.']]);
    }
    expect(Storage::disk('uploads')->allFiles())->toBe([]);
})->with([
    'texto puro' => ["isto não é um PDF\n"],
    'página HTML' => ['<html><body>oi</body></html>'],
    'script PHP' => ['<?php system($_GET["c"]);'],
    'executável' => ["MZ\x90\x00\x03\x00\x00\x00"],
    'vazio' => [''],
    'assinatura fora do começo' => ["lixo\n%PDF-1.4\n"],
    'imagem JPEG' => [jpegBytes()],
]);

it('BR-041 recusa PDF polyglot com tag PHP dentro, mesmo com a assinatura certa', function (string $tag) {
    $content = pdfBytes("%% comentário {$tag}\n");

    expect(fn () => uploads()->store(upload('boletim.pdf', $content, 'application/pdf'), UploadKind::BulletinPdf, 'pdf'))
        ->toThrow(ValidationException::class);
    expect(Storage::disk('uploads')->allFiles())->toBe([]);
})->with([
    '<?php' => ['<?php system($_GET["c"]); ?>'],
    '<?PHP maiúsculo' => ['<?PHP echo 1; ?>'],
    '<?= atalho' => ['<?= `ls` ?>'],
]);

it('BR-041 encontra a tag PHP mesmo quando ela cai na divisa entre dois blocos de leitura', function () {
    $content = pdfBytes(str_repeat('a', 1024 * 1024 - 20).'<?php echo 1;');

    expect(fn () => uploads()->store(upload('b.pdf', $content, 'application/pdf'), UploadKind::BulletinPdf, 'pdf'))
        ->toThrow(ValidationException::class);
});

it('BR-041 devolve 413 com a mensagem do limite para PDF acima de 10 MB', function () {
    $content = pdfBytes(str_repeat('a', 10 * 1024 * 1024));

    expect(fn () => uploads()->store(upload('grande.pdf', $content, 'application/pdf'), UploadKind::BulletinPdf, 'pdf'))
        ->toThrow(PostTooLargeException::class, 'O PDF pode ter no máximo 10 MB.');
    expect(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('BR-041 aceita PDF de exatamente 10 MB', function () {
    $content = pdfBytes();
    $content .= str_repeat('a', 10 * 1024 * 1024 - strlen($content));

    $stored = uploads()->store(upload('limite.pdf', $content, 'application/pdf'), UploadKind::BulletinPdf, 'pdf');

    expect($stored->sizeBytes)->toBe(10 * 1024 * 1024);
});

it('trata erro de upload do PHP por tamanho (upload_max_filesize) como 413', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'up');
    $file = new UploadedFile($tmp, 'a.pdf', 'application/pdf', UPLOAD_ERR_INI_SIZE, true);

    try {
        expect(fn () => uploads()->store($file, UploadKind::BulletinPdf, 'pdf'))
            ->toThrow(PostTooLargeException::class, 'O PDF pode ter no máximo 10 MB.');
    } finally {
        @unlink((string) $tmp);
    }
});

it('trata upload interrompido como arquivo inválido (422)', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'up');
    $file = new UploadedFile($tmp, 'a.pdf', 'application/pdf', UPLOAD_ERR_PARTIAL, true);

    try {
        expect(fn () => uploads()->store($file, UploadKind::BulletinPdf, 'pdf'))->toThrow(ValidationException::class);
    } finally {
        @unlink((string) $tmp);
    }
});

it('BR-045 grava o banner em WebP de 1600 px e 800 px, sem aumentar imagem pequena', function () {
    $large = uploads()->store(upload('banner.jpg', jpegBytes(2400, 1200), 'image/jpeg'), UploadKind::EventBanner, 'banner');

    expect($large->path)->toMatch('#^eventos/\d{4}/[0-9a-f]{32}\.webp$#')
        ->and($large->variants)->toHaveCount(1)
        ->and($large->variants[0])->toMatch('#^eventos/\d{4}/[0-9a-f]{32}-800\.webp$#')
        ->and(dimensionsOf($large->path))->toBe([1600, 800])
        ->and(dimensionsOf($large->variants[0]))->toBe([800, 400])
        ->and($large->sizeBytes)->toBe(strlen((string) Storage::disk('uploads')->get($large->path)));

    $small = uploads()->store(upload('pequeno.png', pngBytes(500, 300), 'image/png'), UploadKind::EventBanner, 'banner');

    expect(dimensionsOf($small->path))->toBe([500, 300])->and(dimensionsOf($small->variants[0]))->toBe([500, 300]);
});

it('BR-045 aceita banner JPEG, PNG e WebP', function (string $content, string $mime) {
    $stored = uploads()->store(upload('banner', $content, $mime), UploadKind::EventBanner, 'banner');

    expect(Storage::disk('uploads')->exists($stored->path))->toBeTrue()
        ->and(mime_content_type(Storage::disk('uploads')->path($stored->path)))->toBe('image/webp');
})->with([
    'jpeg' => [fn () => jpegBytes(), 'image/jpeg'],
    'png' => [fn () => pngBytes(), 'image/png'],
    'webp' => [fn () => webpBytes(), 'image/webp'],
]);

it('BR-045 remove o EXIF da imagem (ex.: a localização GPS de uma foto de celular)', function () {
    $secret = 'CAMERA-MAKE-E-GPS-SECRETOS';
    $jpeg = withExif(jpegBytes(300, 200), $secret);
    expect($jpeg)->toContain($secret); // o arquivo de entrada realmente carrega o EXIF

    $stored = uploads()->store(upload('foto.jpg', $jpeg, 'image/jpeg'), UploadKind::EventBanner, 'banner');

    foreach ($stored->allPaths() as $path) {
        $bytes = (string) Storage::disk('uploads')->get($path);
        expect($bytes)->not->toContain($secret)->not->toContain('Exif');
    }
});

it('BR-045 elimina a carga PHP escondida depois do fim do JPEG (polyglot)', function () {
    $polyglot = jpegBytes(120, 80, "\n<?php system(\$_GET['c']); ?>\n");
    expect($polyglot)->toContain('<?php');

    $stored = uploads()->store(upload('foto.jpg', $polyglot, 'image/jpeg'), UploadKind::EventBanner, 'banner');

    foreach ($stored->allPaths() as $path) {
        expect((string) Storage::disk('uploads')->get($path))->not->toContain('<?php')->not->toContain('system(');
    }
});

it('BR-045 recusa o que não é imagem permitida mesmo com Content-Type de imagem', function (string $content, string $claimedMime) {
    $attempt = fn () => uploads()->store(upload('banner.jpg', $content, $claimedMime), UploadKind::EventBanner, 'banner');

    expect($attempt)->toThrow(ValidationException::class);
    try {
        $attempt();
    } catch (ValidationException $e) {
        expect($e->errors())->toBe(['banner' => ['A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.']]);
    }
    expect(Storage::disk('uploads')->allFiles())->toBe([]);
})->with([
    'script PHP' => ['<?php system($_GET["c"]);', 'image/jpeg'],
    'GIF89a com PHP' => ["GIF89a<?php system(\$_GET['c']); ?>", 'image/gif'],
    'GIF válido' => ["GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xFF\xFF\xFF!\xF9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;", 'image/gif'],
    'SVG com script' => ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'],
    'PDF' => [pdfBytes(), 'image/jpeg'],
    'JPEG truncado' => [substr(jpegBytes(), 0, 20), 'image/jpeg'],
    'vazio' => ['', 'image/jpeg'],
]);

it('BR-045 devolve 413 com a mensagem do limite para banner acima de 3 MB', function () {
    $big = jpegBytes(40, 30, str_repeat('a', 3 * 1024 * 1024));

    expect(fn () => uploads()->store(upload('banner.jpg', $big, 'image/jpeg'), UploadKind::EventBanner, 'banner'))
        ->toThrow(PostTooLargeException::class, 'A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.');
});

it('recusa imagem com dimensões que estourariam a memória do GD, antes de decodificar', function () {
    // PNG de 1x1 com o cabeçalho (IHDR) trocado para 6000 x 6000 = 36 megapixels
    $png = pngBytes(1, 1);
    $huge = substr($png, 0, 16).pack('NN', 6000, 6000).substr($png, 24);

    try {
        uploads()->store(upload('enorme.png', $huge, 'image/png'), UploadKind::EventBanner, 'banner');
        $this->fail('Deveria ter recusado');
    } catch (ValidationException $e) {
        expect($e->errors())->toBe(['banner' => ['A imagem tem dimensões grandes demais.']]);
    }
});

it('BR-045 grava o QR Code do PIX como PNG de até 1000 px, a partir de PNG ou JPEG', function (string $content, string $mime) {
    $stored = uploads()->store(upload('qr', $content, $mime), UploadKind::PixQr, 'qr');

    expect($stored->path)->toMatch('#^pix/\d{4}/[0-9a-f]{32}\.png$#')
        ->and($stored->variants)->toBe([])
        ->and(mime_content_type(Storage::disk('uploads')->path($stored->path)))->toBe('image/png')
        ->and(max(dimensionsOf($stored->path)))->toBeLessThanOrEqual(1000);
})->with([
    'png grande' => [fn () => pngBytes(1500, 1500), 'image/png'],
    'jpeg pequeno' => [fn () => jpegBytes(300, 300), 'image/jpeg'],
]);

it('BR-045 recusa WebP no QR Code (só PNG ou JPEG) e acima de 1 MB', function () {
    expect(fn () => uploads()->store(upload('qr.webp', webpBytes(), 'image/webp'), UploadKind::PixQr, 'qr'))
        ->toThrow(ValidationException::class);

    $big = jpegBytes(40, 30, str_repeat('a', 1024 * 1024));
    expect(fn () => uploads()->store(upload('qr.jpg', $big, 'image/jpeg'), UploadKind::PixQr, 'qr'))
        ->toThrow(PostTooLargeException::class, 'O QR Code precisa ser PNG ou JPEG, com até 1 MB.');
});

it('apaga o arquivo e a variante de 800 px', function () {
    $stored = uploads()->store(upload('banner.png', pngBytes(900, 500), 'image/png'), UploadKind::EventBanner, 'banner');
    expect(Storage::disk('uploads')->allFiles())->toHaveCount(2);

    uploads()->delete($stored->path);

    expect(Storage::disk('uploads')->allFiles())->toBe([]);
});

it('só apaga caminhos gerados pelo próprio serviço (sem path traversal)', function (string $path) {
    Storage::disk('uploads')->put('boletins/2026/ficha.txt', 'manter');
    Storage::disk('uploads')->put('outro/arquivo.pdf', 'manter');

    uploads()->delete($path);

    expect(Storage::disk('uploads')->exists('boletins/2026/ficha.txt'))->toBeTrue()
        ->and(Storage::disk('uploads')->exists('outro/arquivo.pdf'))->toBeTrue();
})->with([
    'sobe diretório' => ['../.env'],
    'dentro de outro diretório' => ['outro/arquivo.pdf'],
    'nome previsível' => ['boletins/2026/ficha.txt'],
    'hex curto' => ['boletins/2026/abc.pdf'],
    'extensão perigosa' => ['boletins/2026/'.str_repeat('a', 32).'.php'],
    'vazio' => [''],
]);

it('reconhece os caminhos que ele mesmo gera e calcula a variante pequena', function () {
    $hex = str_repeat('ab', 16);

    expect(UploadStore::isStoredPath("boletins/2026/{$hex}.pdf"))->toBeTrue()
        ->and(UploadStore::isStoredPath("eventos/2026/{$hex}.webp"))->toBeTrue()
        ->and(UploadStore::isStoredPath("eventos/2026/{$hex}-800.webp"))->toBeTrue()
        ->and(UploadStore::isStoredPath("pix/2026/{$hex}.png"))->toBeTrue()
        ->and(UploadStore::isStoredPath("pix/26/{$hex}.png"))->toBeFalse()
        ->and(UploadStore::smallVariantOf("eventos/2026/{$hex}.webp"))->toBe("eventos/2026/{$hex}-800.webp");
});

it('devolve a URL pública do arquivo', function () {
    $stored = uploads()->store(upload('a.pdf', pdfBytes(), 'application/pdf'), UploadKind::BulletinPdf);

    expect(uploads()->url($stored->path))->toEndWith('/'.$stored->path);
});
