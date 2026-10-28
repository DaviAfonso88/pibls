<?php

declare(strict_types=1);

namespace App\Modules\Platform\Reports;

use Carbon\CarbonInterface;
use Generator;

/**
 * Lê os logs JSON da aplicação (`app-AAAA-MM-DD.log`, uma linha por evento, Observability → Logging) numa janela de
 * tempo. A janela é meio aberta: `[from, to)`. As datas dos arquivos e os `timestamp` das linhas são UTC. Linha que não é
 * JSON (trecho cortado, outro formato) é ignorada: o resumo nunca pode quebrar por causa de um log sujo.
 */
final class LogReader
{
    private const TIMESTAMP_FORMAT = 'Y-m-d\TH:i:s.v\Z';

    public function __construct(private readonly string $directory) {}

    public static function fromConfig(): self
    {
        return new self((string) config('pibls.logs_path'));
    }

    /**
     * @return Generator<int, array<string, mixed>>
     */
    public function lines(CarbonInterface $from, CarbonInterface $to): Generator
    {
        $fromIso = $from->copy()->utc()->format(self::TIMESTAMP_FORMAT);
        $toIso = $to->copy()->utc()->format(self::TIMESTAMP_FORMAT);

        for ($day = $from->copy()->utc()->startOfDay(); $day->lte($to->copy()->utc()); $day = $day->addDay()) {
            $path = $this->directory.'/app-'.$day->format('Y-m-d').'.log';
            $handle = is_file($path) ? fopen($path, 'rb') : false;
            if ($handle === false) {
                continue;
            }

            while (($raw = fgets($handle)) !== false) {
                $line = json_decode($raw, true);
                $timestamp = is_array($line) ? ($line['timestamp'] ?? null) : null;

                // O formato do timestamp é fixo, então a ordem das strings é a ordem do tempo
                if (is_string($timestamp) && $timestamp >= $fromIso && $timestamp < $toIso) {
                    /** @var array<string, mixed> $line */
                    yield $line;
                }
            }
            fclose($handle);
        }
    }

    /**
     * Percentil pelo método do posto mais próximo (nearest rank): o menor valor que cobre `$percent`% das amostras.
     *
     * @param  list<int|float>  $samples
     */
    public static function percentile(array $samples, float $percent): int|float|null
    {
        if ($samples === []) {
            return null;
        }

        sort($samples);

        // round() antes do ceil(): 95 * 20 / 100 não pode virar 19.000000000000004 e pular para o 20º valor
        return $samples[max(0, (int) ceil(round($percent * count($samples) / 100, 6)) - 1)];
    }
}
