<?php

declare(strict_types=1);

namespace App\Modules\Platform\Snapshots;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use InvalidArgumentException;
use RuntimeException;

/**
 * Grava `data/<nome>.json` de forma atômica: escreve num arquivo temporário na mesma pasta e troca pelo definitivo com
 * `rename()`. O Apache serve esses arquivos direto, sem PHP, então um leitor concorrente nunca pode ver um arquivo
 * pela metade: ele recebe o JSON antigo inteiro ou o novo inteiro.
 *
 * Formato: `{"data": …, "generated_at": "2026-11-08T13:10:00Z"}` (contracts/snapshots.md).
 */
final class SnapshotWriter
{
    public function __construct(private readonly string $directory) {}

    /**
     * @param  array<array-key, mixed>  $data
     */
    public function write(string $name, array $data, ?DateTimeInterface $generatedAt = null): string
    {
        if (preg_match('/^[a-z0-9][a-z0-9-]*$/', $name) !== 1) {
            throw new InvalidArgumentException("Nome de snapshot inválido: {$name}.");
        }

        if (! is_dir($this->directory) && ! @mkdir($this->directory, 0755, true) && ! is_dir($this->directory)) {
            throw new RuntimeException("Não foi possível criar a pasta de snapshots {$this->directory}.");
        }

        $json = json_encode(
            [
                'data' => $data,
                'generated_at' => CarbonImmutable::instance($generatedAt ?? CarbonImmutable::now('UTC'))->utc()->format('Y-m-d\TH:i:s\Z'),
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR,
        );

        $target = $this->path($name);
        $temporary = sprintf('%s/.%s.json.%s.tmp', $this->directory, $name, bin2hex(random_bytes(6)));

        if (file_put_contents($temporary, $json, LOCK_EX) === false) {
            throw new RuntimeException("Não foi possível gravar o snapshot temporário de {$name}.");
        }

        // O Apache precisa ler o arquivo; o PHP cria o temporário com a permissão do processo (às vezes 0600)
        @chmod($temporary, 0644);

        if (! @rename($temporary, $target)) {
            @unlink($temporary);

            throw new RuntimeException("Não foi possível publicar o snapshot {$name}.");
        }

        return $target;
    }

    public function path(string $name): string
    {
        return $this->directory.'/'.$name.'.json';
    }
}
