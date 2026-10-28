<?php

declare(strict_types=1);

namespace App\Modules\Content\Support;

use Carbon\CarbonImmutable;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Lê a planilha do conteúdo legado (FR-071) que o `pibls:import-legacy` importa. Aceita o que o Excel e o LibreOffice
 * gravam em português: CSV com `;` (ou `,`, ou tabulação), UTF-8 com ou sem BOM, ou Windows-1252. Os nomes das colunas são
 * comparados sem acento, sem maiúsculas e com `_` no lugar de espaços e símbolos (`Edição`, `edicao` e `EDIÇÃO ` valem o
 * mesmo). Células com quebra de linha dentro de aspas (corpo de uma mensagem) funcionam.
 *
 * Cada linha volta como `coluna canônica => texto`; o que a planilha traz a mais é ignorado.
 */
final class LegacySheet
{
    private const TIMEZONE = 'America/Sao_Paulo';

    /** Nome canônico => apelidos aceitos no cabeçalho (já normalizados). */
    public const COLUMNS = [
        'boletins' => [
            'edition' => ['edicao', 'numero', 'n', 'no', 'edicao_numero'],
            'reference_date' => ['data', 'data_referencia', 'data_do_boletim', 'domingo'],
            'title' => ['titulo'],
            'pdf' => ['pdf', 'arquivo', 'arquivo_pdf', 'caminho', 'caminho_pdf', 'caminho_do_pdf'],
            'summary' => ['resumo', 'descricao'],
            'published_at' => ['publicado_em', 'publicacao', 'data_publicacao', 'data_de_publicacao'],
        ],
        'mensagens' => [
            'published_at' => ['data', 'publicado_em', 'publicacao', 'data_publicacao', 'data_de_publicacao'],
            'title' => ['titulo'],
            'slug' => ['slug', 'endereco', 'url'],
            'body' => ['texto', 'corpo', 'conteudo', 'mensagem'],
            'youtube' => ['youtube', 'video', 'link', 'link_do_youtube', 'link_youtube'],
            'author' => ['autor', 'pregador', 'por'],
        ],
    ];

    /**
     * @param  'boletins'|'mensagens'  $type
     * @return list<array<string, string>> linhas, indexadas a partir de 0 (a linha 1 da planilha é o cabeçalho)
     */
    public static function read(string $path, string $type): array
    {
        $raw = @file_get_contents($path);
        if ($raw === false) {
            throw new InvalidArgumentException("Não foi possível ler a planilha {$path}.");
        }

        $raw = self::toUtf8($raw);
        $stream = fopen('php://temp', 'r+');
        if ($stream === false) {
            throw new InvalidArgumentException('Sem memória para ler a planilha.');
        }
        fwrite($stream, $raw);
        rewind($stream);

        $delimiter = self::delimiter($raw);
        $header = fgetcsv($stream, null, $delimiter, '"', '');
        if ($header === false || $header === [null]) {
            throw new InvalidArgumentException('A planilha está vazia.');
        }

        $map = self::columnMap($header, $type);
        $rows = [];

        while (($cells = fgetcsv($stream, null, $delimiter, '"', '')) !== false) {
            // Linha em branco (só separadores) é ignorada
            if (trim(implode('', array_map('strval', $cells))) === '') {
                continue;
            }

            $row = [];
            foreach ($map as $column => $index) {
                $row[$column] = trim((string) ($cells[$index] ?? ''));
            }
            $rows[] = $row;
        }
        fclose($stream);

        return $rows;
    }

    /**
     * Data (`dd/mm/aaaa` ou `aaaa-mm-dd`, com hora opcional) lida como horário de São Paulo e devolvida em UTC. Sem hora, vale
     * 08:00: o boletim sai no domingo de manhã (SC-006), e a hora original do legado quase nunca existe.
     */
    public static function parseInstant(string $value): ?CarbonImmutable
    {
        $value = trim($value);
        foreach (['d/m/Y H:i:s', 'd/m/Y H:i', 'Y-m-d H:i:s', 'Y-m-d H:i', 'Y-m-d\TH:i:s', 'Y-m-d\TH:i'] as $format) {
            $date = self::strict($format, $value);
            if ($date !== null) {
                return CarbonImmutable::instance($date)->utc();
            }
        }

        $day = self::parseDate($value);

        return $day === null ? null : CarbonImmutable::instance(self::strict('Y-m-d H:i', $day.' 08:00') ?? new DateTimeImmutable)->utc();
    }

    /** Só a data, em `aaaa-mm-dd`. */
    public static function parseDate(string $value): ?string
    {
        $value = trim($value);
        foreach (['d/m/Y', 'Y-m-d', 'd-m-Y', 'd/m/y'] as $format) {
            $date = self::strict($format, $value);
            if ($date !== null) {
                return $date->format('Y-m-d');
            }
        }

        return null;
    }

    /** A data no formato pedido, no horário de São Paulo, ou `null`. Dia 31/02 não vira 03/03: volta para o texto e compara. */
    private static function strict(string $format, string $value): ?DateTimeImmutable
    {
        $date = DateTimeImmutable::createFromFormat('!'.$format, $value, new DateTimeZone(self::TIMEZONE));

        return $date !== false && $date->format($format) === $value ? $date : null;
    }

    /** Texto puro vira parágrafos (`<p>`); o que já tem marcação HTML segue como está (o servidor sanitiza depois). */
    public static function toHtml(string $text): string
    {
        if (preg_match('/<\s*(p|br|div|ul|ol|h[1-6]|strong|em|a)\b/i', $text) === 1) {
            return $text;
        }

        $paragraphs = preg_split('/\R{2,}/', trim($text)) ?: [];

        return implode('', array_map(
            fn (string $paragraph): string => '<p>'.(preg_replace('/\R/', '<br>', e(trim($paragraph))) ?? '').'</p>',
            array_filter($paragraphs, fn (string $paragraph): bool => trim($paragraph) !== ''),
        ));
    }

    /** O endereço de uma mensagem a partir do título, quando a planilha não traz `slug`. */
    public static function slugFor(string $title): string
    {
        return Str::limit(Str::slug($title), 160, '');
    }

    private static function toUtf8(string $raw): string
    {
        if (str_starts_with($raw, "\xEF\xBB\xBF")) {
            $raw = substr($raw, 3);
        }

        // O Excel em português grava Windows-1252 quando se escolhe "CSV" simples
        return mb_check_encoding($raw, 'UTF-8') ? $raw : mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');
    }

    private static function delimiter(string $raw): string
    {
        $firstLine = strtok($raw, "\n") ?: '';
        $counts = [';' => substr_count($firstLine, ';'), ',' => substr_count($firstLine, ','), "\t" => substr_count($firstLine, "\t")];
        arsort($counts);

        return (string) array_key_first($counts);
    }

    /**
     * @param  list<string|null>  $header
     * @return array<string, int> coluna canônica => posição na planilha
     */
    private static function columnMap(array $header, string $type): array
    {
        $normalized = array_map(fn (?string $name): string => trim(preg_replace('/[^a-z0-9]+/', '_', Str::lower(Str::ascii((string) $name))) ?? '', '_'), $header);

        $map = [];
        foreach (self::COLUMNS[$type] as $canonical => $aliases) {
            foreach ($aliases as $alias) {
                $index = array_search($alias, $normalized, true);
                if ($index !== false) {
                    $map[$canonical] = (int) $index;
                    break;
                }
            }
        }

        return $map;
    }
}
