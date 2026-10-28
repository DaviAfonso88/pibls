<?php

declare(strict_types=1);

namespace App\Modules\Content\Console;

use App\Modules\Access\Models\User;
use App\Modules\Content\Actions\CreateBulletin;
use App\Modules\Content\Actions\CreatePalavraViva;
use App\Modules\Content\Http\Requests\StoreBulletinRequest;
use App\Modules\Content\Http\Requests\StorePalavraVivaRequest;
use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Content\Support\LegacySheet;
use App\Modules\Platform\Files\UploadKind;
use App\Shared\Http\BusinessRuleException;
use Illuminate\Console\Command;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Throwable;

/**
 * `pibls:import-legacy boletins|mensagens <planilha.csv>` (FR-071): importa em lote o conteúdo do site antigo que a liderança
 * aprovou (TBD-08), preservando as datas originais: `reference_date` e `published_at` do boletim, `published_at` da mensagem.
 *
 * Passa pelas mesmas Actions e pelas mesmas regras do painel (PDF conferido pelo `UploadStore`, corpo sanitizado, edição e
 * endereço únicos, auditoria): nada entra por um caminho mais frouxo. É idempotente (o que já existe é pulado, então dá para
 * rodar de novo depois de corrigir a planilha) e `--simular` só confere, sem gravar nada. Roda na máquina do responsável, contra o
 * banco local ou o de homologação (a exportação para a produção é a do cutover, `docs/runbooks/cutover.md`).
 *
 * Boletins: colunas `edição`, `data` (domingo de referência), `título`, `pdf` (caminho relativo a `--pdfs`) e, se houver,
 * `resumo` e `publicado_em`. Mensagens: `data`, `título`, `texto` e, se houver, `slug`, `youtube` e `autor`.
 */
final class ImportLegacyCommand extends Command
{
    protected $signature = 'pibls:import-legacy
        {tipo : boletins ou mensagens}
        {planilha : CSV com o conteúdo (separador ; , ou tabulação; UTF-8 ou Windows-1252)}
        {--pdfs= : Pasta dos PDFs, para os boletins (o caminho da coluna pdf é relativo a ela)}
        {--usuario= : E-mail de quem consta como autor do cadastro (precisa existir e estar ativo)}
        {--simular : Só confere a planilha e os arquivos; não grava nada}';

    protected $description = 'Importa boletins e mensagens do site antigo, preservando as datas originais';

    /** O que já apareceu na própria planilha (edição ou endereço repetidos): a simulação não grava, então o banco não os mostra. */
    /** @var array<string, true> */
    private array $seen = [];

    /** Colunas sem as quais a linha não tem como ser importada. */
    private const REQUIRED = [
        'boletins' => ['edition', 'reference_date', 'title', 'pdf'],
        'mensagens' => ['published_at', 'title', 'body'],
    ];

    public function handle(CreateBulletin $createBulletin, CreatePalavraViva $createPost): int
    {
        $type = (string) $this->argument('tipo');
        if (! in_array($type, ['boletins', 'mensagens'], true)) {
            $this->error('O tipo precisa ser "boletins" ou "mensagens".');

            return self::FAILURE;
        }

        $this->seen = [];
        $simulate = (bool) $this->option('simular');
        $actor = null;
        if (! $simulate) {
            $actor = User::query()->where('email', (string) $this->option('usuario'))->where('is_active', true)->first();
            if ($actor === null) {
                $this->error('Informe --usuario com o e-mail de um usuário ativo (Comunicação ou administrador técnico): é quem consta como autor do cadastro.');

                return self::FAILURE;
            }
        }

        $pdfDirectory = null;
        if ($type === 'boletins') {
            // `realpath('')` devolve a pasta atual: um --pdfs vazio não pode virar "qualquer PDF daqui"
            $pdfDirectory = (string) $this->option('pdfs') === '' ? false : realpath((string) $this->option('pdfs'));
            if ($pdfDirectory === false || ! is_dir($pdfDirectory)) {
                $this->error('Informe --pdfs com a pasta onde estão os PDFs dos boletins.');

                return self::FAILURE;
            }
        }

        try {
            /** @var 'boletins'|'mensagens' $type */
            $rows = LegacySheet::read((string) $this->argument('planilha'), $type);
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $missing = array_diff(self::REQUIRED[$type], array_keys($rows[0] ?? []));
        if ($rows !== [] && $missing !== []) {
            $this->error('Faltam colunas na planilha: '.implode(', ', array_map(fn (string $column): string => $this->label($column), $missing)).'.');

            return self::FAILURE;
        }

        $created = $skipped = $errors = 0;

        foreach ($rows as $index => $row) {
            $line = $index + 2; // a linha 1 é o cabeçalho
            try {
                $result = $type === 'boletins'
                    ? $this->importBulletin($row, (string) $pdfDirectory, $simulate, $actor, $createBulletin)
                    : $this->importPost($row, $simulate, $actor, $createPost);
            } catch (Throwable $e) {
                $errors++;
                $this->line("  Linha {$line}: <error>erro</error> ".$this->reason($e));

                continue;
            }

            if ($result === 'skipped') {
                $skipped++;
                $this->line("  Linha {$line}: já existe, pulada.");
            } else {
                $created++;
            }
        }

        $verb = $simulate ? 'seriam criados' : 'criados';
        $this->newLine();
        $this->info("{$created} {$verb}, {$skipped} já existiam, {$errors} com erro.".($simulate ? ' (simulação: nada foi gravado)' : ''));

        return $errors === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  array<string, string>  $row
     * @return 'created'|'skipped'
     */
    private function importBulletin(array $row, string $pdfDirectory, bool $simulate, ?User $actor, CreateBulletin $create): string
    {
        $referenceDate = LegacySheet::parseDate($row['reference_date']);
        $publishedAt = ($row['published_at'] ?? '') !== '' ? LegacySheet::parseInstant($row['published_at']) : ($referenceDate === null ? null : LegacySheet::parseInstant($referenceDate));

        if ($referenceDate === null || $publishedAt === null) {
            throw new InvalidArgumentException('data inválida (use dd/mm/aaaa ou aaaa-mm-dd).');
        }

        $data = [
            'edition_number' => (int) $row['edition'],
            'reference_date' => $referenceDate,
            'title' => $row['title'],
            'summary_text' => ($row['summary'] ?? '') !== '' ? $row['summary'] : null,
        ];

        $rules = collect((new StoreBulletinRequest)->rules())->except(['pdf', 'published_at'])->all();
        Validator::make($data, $rules)->validate();

        if (isset($this->seen['b'.$data['edition_number']]) || Bulletin::query()->where('edition_number', $data['edition_number'])->exists()) {
            return 'skipped';
        }

        $pdf = $this->pdf($pdfDirectory, $row['pdf']);

        if (! $simulate) {
            $create($data, $pdf, $publishedAt, $actor ?? throw new InvalidArgumentException('sem usuário'));
        }
        $this->seen['b'.$data['edition_number']] = true;

        return 'created';
    }

    /**
     * @param  array<string, string>  $row
     * @return 'created'|'skipped'
     */
    private function importPost(array $row, bool $simulate, ?User $actor, CreatePalavraViva $create): string
    {
        $publishedAt = LegacySheet::parseInstant($row['published_at']);
        if ($publishedAt === null) {
            throw new InvalidArgumentException('data inválida (use dd/mm/aaaa ou aaaa-mm-dd).');
        }

        $slug = ($row['slug'] ?? '') !== '' ? $row['slug'] : LegacySheet::slugFor($row['title']);
        $data = [
            'title' => $row['title'],
            'slug' => $slug,
            'body' => LegacySheet::toHtml($row['body']),
            'author_display' => ($row['author'] ?? '') !== '' ? $row['author'] : null,
            'youtube_url' => ($row['youtube'] ?? '') !== '' ? $row['youtube'] : null,
        ];

        $rules = collect((new StorePalavraVivaRequest)->rules())->except(['published_at'])->all();
        Validator::make($data, $rules)->validate();

        if (isset($this->seen['m'.$slug]) || PalavraVivaPost::query()->where('slug', $slug)->exists()) {
            return 'skipped';
        }

        if (! $simulate) {
            $create($data, $publishedAt, $actor ?? throw new InvalidArgumentException('sem usuário'));
        }
        // Só depois de dar certo: uma linha com erro não pode fazer a repetida passar por "já existe"
        $this->seen['m'.$slug] = true;

        return 'created';
    }

    /** O PDF da pasta informada, nunca de fora dela (`..` e caminhos absolutos são recusados). */
    private function pdf(string $directory, string $relative): UploadedFile
    {
        if ($relative === '') {
            throw new InvalidArgumentException('a coluna do PDF está vazia.');
        }

        $path = realpath($directory.DIRECTORY_SEPARATOR.$relative);
        if ($path === false || ! is_file($path)) {
            throw new InvalidArgumentException("PDF não encontrado: {$relative}");
        }
        if (! str_starts_with($path, $directory.DIRECTORY_SEPARATOR)) {
            throw new InvalidArgumentException("o PDF precisa estar dentro da pasta informada: {$relative}");
        }
        if (filesize($path) > UploadKind::BulletinPdf->maxBytes()) {
            throw new InvalidArgumentException("PDF acima do limite de 10 MB: {$relative}");
        }
        if (file_get_contents($path, false, null, 0, 5) !== '%PDF-') {
            throw new InvalidArgumentException("o arquivo não é um PDF: {$relative}");
        }

        // Modo de teste: o arquivo veio do disco do responsável, não de um envio HTTP; o UploadStore confere tipo e conteúdo do mesmo jeito
        return new UploadedFile($path, basename($path), 'application/pdf', null, true);
    }

    private function reason(Throwable $e): string
    {
        return match (true) {
            $e instanceof ValidationException => implode(' ', array_map(fn (array $messages): string => implode(' ', $messages), $e->errors())),
            $e instanceof BusinessRuleException, $e instanceof PostTooLargeException, $e instanceof InvalidArgumentException => $e->getMessage(),
            default => 'falha inesperada ('.class_basename($e).').',
        };
    }

    private function label(string $column): string
    {
        return match ($column) {
            'edition' => 'edição',
            'reference_date' => 'data',
            'title' => 'título',
            'pdf' => 'pdf',
            'published_at' => 'data',
            'body' => 'texto',
            default => $column,
        };
    }
}
