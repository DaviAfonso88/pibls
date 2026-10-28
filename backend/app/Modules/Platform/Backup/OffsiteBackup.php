<?php

declare(strict_types=1);

namespace App\Modules\Platform\Backup;

use Carbon\CarbonInterface;
use Closure;
use Illuminate\Contracts\Filesystem\Filesystem;
use RuntimeException;
use Throwable;

/**
 * Cópia diária dos backups para o Backblaze B2 (I-09): o dump cifrado do dia em `db/daily/AAAA-MM-DD.sql.gz.enc`, a cópia
 * mensal em `db/monthly/AAAA-MM.sql.gz.enc` no dia 1 e os uploads novos em `uploads/…`. O B2 aplica as regras de ciclo
 * de vida (35 dias e 12 meses); este código NUNCA apaga nada lá, e a chave de aplicação nem tem essa permissão.
 *
 * Cada gravação tenta de novo com a espera de `$backoff` (1, 5 e 15 min), na mesma execução. O disco remoto só
 * precisa de `allFiles` e `writeStream`.
 */
class OffsiteBackup
{
    /**
     * @param  list<int>  $backoff  segundos de espera antes de cada nova tentativa
     * @param  Closure(int): void  $sleep  troca de `sleep` nos testes
     */
    public function __construct(
        private readonly Filesystem $remote,
        private readonly Filesystem $uploads,
        private readonly array $backoff,
        private readonly Closure $sleep,
    ) {}

    /**
     * @return array{daily: string, monthly: string|null, uploads: int}
     */
    public function run(string $dumpPath, CarbonInterface $now): array
    {
        $day = $now->copy()->setTimezone('America/Sao_Paulo');

        $daily = 'db/daily/'.$day->format('Y-m-d').'.sql.gz.enc';
        $this->send($daily, $dumpPath);

        $monthly = null;
        if ($day->day === 1) {
            $monthly = 'db/monthly/'.$day->format('Y-m').'.sql.gz.enc';
            $this->send($monthly, $dumpPath);
        }

        return ['daily' => $daily, 'monthly' => $monthly, 'uploads' => $this->syncUploads()];
    }

    /** Envia os uploads que ainda não estão no B2 (nomes únicos e imutáveis: o que já existe não é reenviado). */
    private function syncUploads(): int
    {
        $existing = array_flip($this->withRetries(fn () => $this->remote->allFiles('uploads')));
        $sent = 0;

        foreach ($this->uploads->allFiles() as $path) {
            // Arquivos ocultos (.htaccess) são da hospedagem, não conteúdo
            if (str_starts_with(basename($path), '.') || isset($existing['uploads/'.$path])) {
                continue;
            }

            $this->withRetries(function () use ($path): void {
                $stream = $this->uploads->readStream($path);
                if (! is_resource($stream)) {
                    throw new RuntimeException("Não foi possível ler o upload {$path}.");
                }
                try {
                    $this->remote->writeStream('uploads/'.$path, $stream);
                } finally {
                    fclose($stream);
                }
            });
            $sent++;
        }

        return $sent;
    }

    private function send(string $key, string $localPath): void
    {
        $this->withRetries(function () use ($key, $localPath): void {
            $stream = fopen($localPath, 'rb');
            if ($stream === false) {
                throw new RuntimeException("Não foi possível ler {$localPath}.");
            }
            try {
                $this->remote->writeStream($key, $stream);
            } finally {
                fclose($stream);
            }
        });
    }

    /**
     * @template T
     *
     * @param  Closure(): T  $operation
     * @return T
     */
    private function withRetries(Closure $operation): mixed
    {
        $attempt = 0;

        while (true) {
            try {
                return $operation();
            } catch (Throwable $e) {
                if ($attempt >= count($this->backoff)) {
                    throw $e;
                }
                ($this->sleep)($this->backoff[$attempt]);
                $attempt++;
            }
        }
    }
}
