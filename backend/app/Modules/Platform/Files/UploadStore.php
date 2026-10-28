<?php

declare(strict_types=1);

namespace App\Modules\Platform\Files;

use finfo;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Intervention\Image\ImageManager;
use Intervention\Image\Interfaces\ImageInterface;
use Throwable;

/**
 * Único ponto de gravação de arquivos públicos (Security → Uploads): `uploads/{boletins,eventos,pix}/AAAA/<32 hex>.<ext>`.
 *
 * Nada que o cliente informa é confiado: nem o nome, nem a extensão, nem o `Content-Type`. O tipo vem do conteúdo
 * (`finfo` + assinatura do arquivo), o tamanho é conferido e o nome é aleatório. Imagens são decodificadas e
 * reencodadas pelo GD, o que apaga EXIF e qualquer carga escondida depois do fim da imagem (polyglot).
 * PDF não dá para reencodar; por isso, além do MIME e da assinatura `%PDF-`, é recusado se levar uma tag PHP.
 *
 * Tipo errado responde 422; arquivo acima do limite, 413 (BR-041, BR-045).
 */
final class UploadStore
{
    /** Acima disto o GD precisaria de memória demais para decodificar (limite de 256 MB do PHP). */
    private const MAX_PIXELS = 25_000_000;

    private const BANNER_LARGE_WIDTH = 1600;

    private const BANNER_SMALL_WIDTH = 800;

    private const QR_MAX_SIDE = 1000;

    private const WEBP_QUALITY = 82;

    public function __construct(
        private readonly ImageManager $images,
        private readonly string $diskName = 'uploads',
    ) {}

    /**
     * @param  string  $field  campo do formulário, para a mensagem de erro de validação (`pdf`, `banner`, `qr`)
     */
    public function store(UploadedFile $file, UploadKind $kind, string $field = 'file'): StoredFile
    {
        $this->assertReceived($file, $kind, $field);

        $path = (string) $file->getRealPath();
        $mime = $this->detectMime($path);
        if ($mime === null || ! in_array($mime, $kind->allowedMimeTypes(), true) || ! $this->hasSignature($path, $mime)) {
            throw ValidationException::withMessages([$field => [$kind->invalidTypeMessage()]]);
        }

        return match ($kind) {
            UploadKind::BulletinPdf => $this->storePdf($path, $kind, $field),
            UploadKind::EventBanner => $this->storeBanner($path, $kind, $field),
            UploadKind::PixQr => $this->storeQr($path, $kind, $field),
        };
    }

    /** Apaga o arquivo e suas variantes. Só aceita caminhos gerados por este serviço (nada de `..`). */
    public function delete(string $path): void
    {
        if (! self::isStoredPath($path)) {
            return;
        }

        foreach ([$path, self::smallVariantOf($path)] as $candidate) {
            if ($this->disk()->exists($candidate)) {
                $this->disk()->delete($candidate);
            }
        }
    }

    public function url(string $path): string
    {
        return Storage::disk($this->diskName)->url($path);
    }

    public static function isStoredPath(string $path): bool
    {
        return preg_match('#^(boletins|eventos|pix)/\d{4}/[0-9a-f]{32}(-800)?\.(pdf|webp|png)$#', $path) === 1;
    }

    /** `eventos/2026/ab…12.webp` → `eventos/2026/ab…12-800.webp`. */
    public static function smallVariantOf(string $path): string
    {
        return (string) preg_replace('/\.webp$/', '-800.webp', $path);
    }

    private function assertReceived(UploadedFile $file, UploadKind $kind, string $field): void
    {
        if (in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new PostTooLargeException($kind->tooLargeMessage());
        }

        if (! $file->isValid() || $file->getRealPath() === false) {
            throw ValidationException::withMessages([$field => [$kind->invalidTypeMessage()]]);
        }

        if ((int) $file->getSize() > $kind->maxBytes()) {
            throw new PostTooLargeException($kind->tooLargeMessage());
        }
    }

    private function detectMime(string $path): ?string
    {
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path);

        return $mime === false ? null : $mime;
    }

    /** Confere os primeiros bytes: o `finfo` sozinho é a primeira linha de defesa, não a única. */
    private function hasSignature(string $path, string $mime): bool
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return false;
        }
        $head = (string) fread($handle, 16);
        fclose($handle);

        return match ($mime) {
            'application/pdf' => str_starts_with($head, '%PDF-'),
            'image/jpeg' => str_starts_with($head, "\xFF\xD8\xFF"),
            'image/png' => str_starts_with($head, "\x89PNG\r\n\x1A\n"),
            'image/webp' => str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP',
            default => false,
        };
    }

    private function storePdf(string $path, UploadKind $kind, string $field): StoredFile
    {
        if ($this->containsPhpTag($path)) {
            throw ValidationException::withMessages([$field => [$kind->invalidTypeMessage()]]);
        }

        $target = $this->newPath($kind, 'pdf');
        $stream = fopen($path, 'rb');
        if ($stream === false) {
            throw ValidationException::withMessages([$field => [$kind->invalidTypeMessage()]]);
        }

        try {
            $this->disk()->put($target, $stream);
        } finally {
            fclose($stream);
        }

        return new StoredFile($target, (int) filesize($path));
    }

    private function storeBanner(string $path, UploadKind $kind, string $field): StoredFile
    {
        $this->assertPixelBudget($path, $kind, $field);

        $large = $this->encode($path, $kind, $field, fn ($image) => $image->scaleDown(width: self::BANNER_LARGE_WIDTH)
            ->toWebp(quality: self::WEBP_QUALITY)->toString());
        $small = $this->encode($path, $kind, $field, fn ($image) => $image->scaleDown(width: self::BANNER_SMALL_WIDTH)
            ->toWebp(quality: self::WEBP_QUALITY)->toString());

        $target = $this->newPath($kind, 'webp');
        $variant = self::smallVariantOf($target);
        $this->disk()->put($target, $large);
        $this->disk()->put($variant, $small);

        return new StoredFile($target, strlen($large), [$variant]);
    }

    private function storeQr(string $path, UploadKind $kind, string $field): StoredFile
    {
        $this->assertPixelBudget($path, $kind, $field);

        $png = $this->encode($path, $kind, $field, fn ($image) => $image
            ->scaleDown(width: self::QR_MAX_SIDE, height: self::QR_MAX_SIDE)
            ->toPng()->toString());

        $target = $this->newPath($kind, 'png');
        $this->disk()->put($target, $png);

        return new StoredFile($target, strlen($png));
    }

    /**
     * Decodifica a imagem do zero a cada chamada (cada variante parte do original) e devolve os bytes reencodados.
     *
     * @param  callable(ImageInterface): string  $transform
     */
    private function encode(string $path, UploadKind $kind, string $field, callable $transform): string
    {
        try {
            return $transform($this->images->read($path));
        } catch (Throwable) {
            // Imagem corrompida ou formato que o GD não decodifica
            throw ValidationException::withMessages([$field => [$kind->invalidTypeMessage()]]);
        }
    }

    private function assertPixelBudget(string $path, UploadKind $kind, string $field): void
    {
        $size = @getimagesize($path);

        if ($size === false) {
            throw ValidationException::withMessages([$field => [$kind->invalidTypeMessage()]]);
        }

        if ($size[0] * $size[1] > self::MAX_PIXELS) {
            throw ValidationException::withMessages([$field => ['A imagem tem dimensões grandes demais.']]);
        }
    }

    private function containsPhpTag(string $path): bool
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return true;
        }

        try {
            $carry = '';
            while (! feof($handle)) {
                $chunk = $carry.(string) fread($handle, 1024 * 1024);
                if (preg_match('/<\?(?:php|=)/i', $chunk) === 1) {
                    return true;
                }
                $carry = substr($chunk, -8); // a tag pode cair na divisa entre dois blocos
            }
        } finally {
            fclose($handle);
        }

        return false;
    }

    private function newPath(UploadKind $kind, string $extension): string
    {
        return sprintf('%s/%s/%s.%s', $kind->directory(), now('UTC')->format('Y'), bin2hex(random_bytes(16)), $extension);
    }

    private function disk(): Filesystem
    {
        return Storage::disk($this->diskName);
    }
}
