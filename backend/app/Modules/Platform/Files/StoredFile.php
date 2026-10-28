<?php

declare(strict_types=1);

namespace App\Modules\Platform\Files;

/**
 * Arquivo gravado no disco `uploads`. Os caminhos são relativos ao disco (`boletins/2026/3f9c…e1.pdf`) e é isso que
 * vai para o banco (`pdf_path`, `banner_path`, `qr_image_path`).
 */
final readonly class StoredFile
{
    /**
     * @param  string  $path  arquivo principal
     * @param  list<string>  $variants  demais arquivos gerados (ex.: a variante de 800 px do banner)
     */
    public function __construct(
        public string $path,
        public int $sizeBytes,
        public array $variants = [],
    ) {}

    /** @return list<string> todos os caminhos gravados, o principal primeiro */
    public function allPaths(): array
    {
        return [$this->path, ...$this->variants];
    }
}
