<?php

declare(strict_types=1);

namespace App\Modules\Platform\Files;

/**
 * Tipos de arquivo público e as regras de cada um (Security → Uploads; BR-041, BR-045).
 */
enum UploadKind: string
{
    /** Boletim: PDF verdadeiro de até 10 MB. */
    case BulletinPdf = 'boletins';

    /** Banner de evento: JPEG, PNG ou WebP de até 3 MB, reencodado em WebP de 1600 px e 800 px. */
    case EventBanner = 'eventos';

    /** QR Code do PIX: PNG ou JPEG de até 1 MB, reencodado em PNG de até 1000 px. */
    case PixQr = 'pix';

    /** Pasta dentro do disco `uploads`. */
    public function directory(): string
    {
        return $this->value;
    }

    public function maxBytes(): int
    {
        return match ($this) {
            self::BulletinPdf => 10 * 1024 * 1024,
            self::EventBanner => 3 * 1024 * 1024,
            self::PixQr => 1024 * 1024,
        };
    }

    /**
     * @return list<string> MIME reais aceitos
     */
    public function allowedMimeTypes(): array
    {
        return match ($this) {
            self::BulletinPdf => ['application/pdf'],
            self::EventBanner => ['image/jpeg', 'image/png', 'image/webp'],
            self::PixQr => ['image/png', 'image/jpeg'],
        };
    }

    /** Mensagem de tipo inválido (BR-041, BR-045). */
    public function invalidTypeMessage(): string
    {
        return match ($this) {
            self::BulletinPdf => 'O arquivo precisa ser um PDF.',
            self::EventBanner => 'A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.',
            self::PixQr => 'O QR Code precisa ser PNG ou JPEG, com até 1 MB.',
        };
    }

    /** Mensagem de arquivo grande demais (BR-041, BR-045). */
    public function tooLargeMessage(): string
    {
        return match ($this) {
            self::BulletinPdf => 'O PDF pode ter no máximo 10 MB.',
            self::EventBanner => 'A imagem precisa ser JPEG, PNG ou WebP, com até 3 MB.',
            self::PixQr => 'O QR Code precisa ser PNG ou JPEG, com até 1 MB.',
        };
    }
}
