<?php

declare(strict_types=1);

use App\Modules\Content\Models\Bulletin;
use App\Modules\Content\Models\PalavraVivaPost;
use App\Modules\Content\Support\LegacySheet;
use App\Modules\Platform\Models\AuditLog;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| Importação do conteúdo legado (FR-071, TBD-08): boletins e mensagens, com as datas originais
|--------------------------------------------------------------------------
*/

const LEGACY_PDF = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n";

beforeEach(function () {
    Storage::fake('uploads');
    $this->dir = sys_get_temp_dir().'/pibls-legacy-'.bin2hex(random_bytes(4));
    File::ensureDirectoryExists($this->dir.'/pdfs/2024');
    $this->actor = userWithRole('COMUNICACAO');
});

afterEach(fn () => File::deleteDirectory($this->dir));

/** Grava a planilha (com o BOM e o separador do Excel em português, a menos que se peça outro). */
function legacySheet(string $dir, string $content, string $name = 'planilha.csv'): string
{
    file_put_contents($dir.'/'.$name, $content);

    return $dir.'/'.$name;
}

function legacyPdf(string $dir, string $relative): void
{
    File::ensureDirectoryExists(dirname($dir.'/pdfs/'.$relative));
    file_put_contents($dir.'/pdfs/'.$relative, LEGACY_PDF);
}

/** @param  array<string, mixed>  $options */
function importLegacy(string $type, string $sheet, string $dir, array $options = []): int
{
    return Artisan::call('pibls:import-legacy', ['tipo' => $type, 'planilha' => $sheet, '--pdfs' => $dir.'/pdfs'] + $options);
}

describe('boletins', function () {
    it('FR-071 importa os boletins preservando a data de referência e a de publicação, e grava o PDF pelo UploadStore', function () {
        legacyPdf($this->dir, '2024/b101.pdf');
        legacyPdf($this->dir, '2024/b102.pdf');
        $sheet = legacySheet($this->dir, "\xEF\xBB\xBFEdição;Data;Título;PDF;Resumo;Publicado em\n"
            ."101;07/01/2024;Boletim de 7 de janeiro;2024/b101.pdf;Resumo do primeiro;05/01/2024 18:30\n"
            ."102;14/01/2024;Boletim de 14 de janeiro;2024/b102.pdf;;\n");

        $exit = importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $this->actor->email]);

        expect($exit)->toBe(0)->and(Artisan::output())->toContain('2 criados, 0 já existiam, 0 com erro');

        $first = Bulletin::query()->where('edition_number', 101)->sole();
        $second = Bulletin::query()->where('edition_number', 102)->sole();
        expect($first->reference_date->format('Y-m-d'))->toBe('2024-01-07')
            ->and($first->published_at->utc()->format('Y-m-d H:i'))->toBe('2024-01-05 21:30') // 18:30 em São Paulo
            ->and($first->summary_text)->toBe('Resumo do primeiro')
            ->and($first->created_by)->toBe($this->actor->getKey())
            // Sem hora na planilha: 08:00 em São Paulo (11:00 UTC) do domingo de referência
            ->and($second->published_at->utc()->format('Y-m-d H:i'))->toBe('2024-01-14 11:00')
            ->and($second->summary_text)->toBeNull();

        expect($first->pdf_path)->toMatch('#^boletins/\d{4}/[0-9a-f]{32}\.pdf$#');
        Storage::disk('uploads')->assertExists($first->pdf_path);
        expect(AuditLog::query()->where('action', 'bulletin.created')->count())->toBe(2);
    });

    it('lê o CSV do Excel em Windows-1252 com vírgula, e datas aaaa-mm-dd', function () {
        legacyPdf($this->dir, 'a.pdf');
        $csv = mb_convert_encoding("edicao,data,titulo,pdf\n7,2023-03-05,Boletim da Ceia ção,a.pdf\n", 'Windows-1252', 'UTF-8');
        $sheet = legacySheet($this->dir, $csv);

        $exit = importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $this->actor->email]);

        expect($exit)->toBe(0)
            ->and(Bulletin::query()->where('edition_number', 7)->value('title'))->toBe('Boletim da Ceia ção');
    });

    it('é idempotente: rodar de novo pula o que já existe e não duplica o PDF', function () {
        legacyPdf($this->dir, 'a.pdf');
        $sheet = legacySheet($this->dir, "edicao;data;titulo;pdf\n1;07/01/2024;Primeiro boletim;a.pdf\n");

        importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $this->actor->email]);
        $exit = importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $this->actor->email]);

        expect($exit)->toBe(0)->and(Artisan::output())->toContain('0 criados, 1 já existiam')
            ->and(Bulletin::query()->count())->toBe(1)
            ->and(Storage::disk('uploads')->allFiles())->toHaveCount(1);
    });

    it('--simular confere tudo e não grava nada, nem arquivo, nem registro, nem exige usuário', function () {
        legacyPdf($this->dir, 'a.pdf');
        $sheet = legacySheet($this->dir, "edicao;data;titulo;pdf\n1;07/01/2024;Primeiro boletim;a.pdf\n1;07/01/2024;Repetido na planilha;a.pdf\n2;14/01/2024;Sem arquivo;sumiu.pdf\n");

        $exit = importLegacy('boletins', $sheet, $this->dir, ['--simular' => true]);

        $output = Artisan::output(); // ler duas vezes devolveria texto vazio na segunda
        expect($exit)->toBe(1)
            ->and($output)->toContain('1 seriam criados, 1 já existiam, 1 com erro')
            ->and($output)->toContain('Linha 4')->toContain('PDF não encontrado: sumiu.pdf')
            ->and(Bulletin::query()->count())->toBe(0)
            ->and(Storage::disk('uploads')->allFiles())->toBe([]);
    });

    it('uma linha com erro não impede as outras, e o comando termina com 1', function () {
        legacyPdf($this->dir, 'ok.pdf');
        file_put_contents($this->dir.'/pdfs/falso.pdf', 'isto não é um pdf');
        $sheet = legacySheet($this->dir, "edicao;data;titulo;pdf\n"
            ."1;07/01/2024;Boletim bom;ok.pdf\n"
            ."2;31/02/2024;Data impossível;ok.pdf\n"
            ."3;14/01/2024;PDF falso;falso.pdf\n"
            ."4;21/01/2024;Ab;ok.pdf\n"
            ."5;28/01/2024;Outro bom;ok.pdf\n");

        $exit = importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $this->actor->email]);

        $output = Artisan::output();
        expect($exit)->toBe(1)
            ->and($output)->toContain('2 criados, 0 já existiam, 3 com erro')
            ->and($output)->toContain('Linha 3')->toContain('data inválida')
            ->and($output)->toContain('Linha 4')->toContain('não é um PDF')
            ->and($output)->toContain('Linha 5')
            ->and(Bulletin::query()->pluck('edition_number')->sort()->values()->all())->toBe([1, 5]);
    });

    it('recusa um PDF fora da pasta informada (.. e caminho absoluto)', function () {
        file_put_contents($this->dir.'/fora.pdf', LEGACY_PDF);
        $sheet = legacySheet($this->dir, "edicao;data;titulo;pdf\n1;07/01/2024;Fuga pela pasta;../fora.pdf\n2;14/01/2024;Caminho absoluto;".$this->dir."/fora.pdf\n");

        $exit = importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $this->actor->email]);

        expect($exit)->toBe(1)->and(Bulletin::query()->count())->toBe(0)
            ->and(Storage::disk('uploads')->allFiles())->toBe([]);
    });

    it('exige usuário ativo, a pasta de PDFs e as colunas obrigatórias', function () {
        legacyPdf($this->dir, 'a.pdf');
        $sheet = legacySheet($this->dir, "edicao;data;titulo;pdf\n1;07/01/2024;Primeiro boletim;a.pdf\n");

        expect(importLegacy('boletins', $sheet, $this->dir))->toBe(1)
            ->and(importLegacy('boletins', $sheet, $this->dir, ['--usuario' => 'ninguem@pibls.test']))->toBe(1);

        $inactive = userWithRole('COMUNICACAO', ['is_active' => false]);
        expect(importLegacy('boletins', $sheet, $this->dir, ['--usuario' => $inactive->email]))->toBe(1);

        $noPdfs = Artisan::call('pibls:import-legacy', ['tipo' => 'boletins', 'planilha' => $sheet, '--usuario' => $this->actor->email]);
        expect($noPdfs)->toBe(1)->and(Artisan::output())->toContain('--pdfs');

        $partial = legacySheet($this->dir, "edicao;titulo\n1;Sem data nem PDF\n", 'parcial.csv');
        expect(importLegacy('boletins', $partial, $this->dir, ['--usuario' => $this->actor->email]))->toBe(1)
            ->and(Artisan::output())->toContain('Faltam colunas')->toContain('data')->toContain('pdf')
            ->and(Bulletin::query()->count())->toBe(0);
    });
});

describe('mensagens', function () {
    it('FR-071 importa as mensagens com a data original, o endereço gerado do título e o corpo sanitizado', function () {
        $sheet = legacySheet($this->dir, "\xEF\xBB\xBFData;Título;Texto;Link;Autor\n"
            .'03/03/2024;Quem é o meu próximo?;"Primeiro parágrafo.

Segundo parágrafo, com & e <aspas>.";https://www.youtube.com/watch?v=dQw4w9WgXcQ;Pr. Joselito
'
            .'10/03/2024;Segunda mensagem;<p>Já em HTML.</p><script>alert(1)</script>;;
');

        $exit = Artisan::call('pibls:import-legacy', ['tipo' => 'mensagens', 'planilha' => $sheet, '--usuario' => $this->actor->email]);

        expect($exit)->toBe(0)->and(Artisan::output())->toContain('2 criados');

        $first = PalavraVivaPost::query()->where('slug', 'quem-e-o-meu-proximo')->sole();
        expect($first->published_at->utc()->format('Y-m-d H:i'))->toBe('2024-03-03 11:00')
            ->and($first->title)->toBe('Quem é o meu próximo?')
            ->and($first->author_display)->toBe('Pr. Joselito')
            ->and($first->youtube_video_id)->toBe('dQw4w9WgXcQ')
            // Texto puro vira parágrafos, com `&` e `<` escapados
            ->and($first->body)->toContain('<p>Primeiro parágrafo.</p>')->toContain('<p>Segundo parágrafo, com &amp; e &lt;aspas&gt;.</p>');

        // HTML que já vinha na planilha passa pelo sanitizador do servidor (BR-046): o <script> não entra
        $second = PalavraVivaPost::query()->where('slug', 'segunda-mensagem')->sole();
        expect($second->body)->toContain('<p>Já em HTML.</p>')->not->toContain('<script')->not->toContain('alert(1)');
    });

    it('é idempotente por endereço, aceita o slug da planilha e recusa link que não é do YouTube', function () {
        $sheet = legacySheet($this->dir, "data;titulo;texto;slug;youtube\n"
            ."03/03/2024;Primeira;Texto um;primeira-mensagem;\n"
            ."10/03/2024;Segunda;Texto dois;segunda-mensagem;https://exemplo.com/video\n");

        $first = Artisan::call('pibls:import-legacy', ['tipo' => 'mensagens', 'planilha' => $sheet, '--usuario' => $this->actor->email]);
        $again = Artisan::call('pibls:import-legacy', ['tipo' => 'mensagens', 'planilha' => $sheet, '--usuario' => $this->actor->email]);

        expect($first)->toBe(1)->and($again)->toBe(1)
            ->and(PalavraVivaPost::query()->pluck('slug')->all())->toBe(['primeira-mensagem']);
    });

    it('--simular não grava mensagens', function () {
        $sheet = legacySheet($this->dir, "data;titulo;texto\n03/03/2024;Primeira mensagem;Texto\n");

        $exit = Artisan::call('pibls:import-legacy', ['tipo' => 'mensagens', 'planilha' => $sheet, '--simular' => true]);

        expect($exit)->toBe(0)->and(Artisan::output())->toContain('1 seriam criados')
            ->and(PalavraVivaPost::query()->count())->toBe(0);
    });
});

describe('tipo e planilha', function () {
    it('recusa um tipo desconhecido e uma planilha que não existe', function () {
        $sheet = legacySheet($this->dir, "edicao;data;titulo;pdf\n");

        expect(Artisan::call('pibls:import-legacy', ['tipo' => 'eventos', 'planilha' => $sheet]))->toBe(1)
            ->and(importLegacy('boletins', $this->dir.'/nao-existe.csv', $this->dir, ['--simular' => true]))->toBe(1)
            ->and(Artisan::output())->toContain('Não foi possível ler');
    });
});

describe('LegacySheet', function () {
    it('lê datas em formatos do Excel e rejeita as impossíveis', function () {
        expect(LegacySheet::parseDate('07/01/2024'))->toBe('2024-01-07')
            ->and(LegacySheet::parseDate('2024-01-07'))->toBe('2024-01-07')
            ->and(LegacySheet::parseDate('31/02/2024'))->toBeNull()
            ->and(LegacySheet::parseDate('ontem'))->toBeNull()
            ->and(LegacySheet::parseInstant('07/01/2024')?->format('Y-m-d H:i'))->toBe('2024-01-07 11:00')
            ->and(LegacySheet::parseInstant('07/01/2024 20:15')?->format('Y-m-d H:i'))->toBe('2024-01-07 23:15')
            ->and(LegacySheet::parseInstant('2024-01-07 20:15:30')?->format('Y-m-d H:i:s'))->toBe('2024-01-07 23:15:30');
    });

    it('transforma texto puro em parágrafos escapados e mantém o HTML que já existe', function () {
        expect(LegacySheet::toHtml("Um & dois.\nA mesma linha.\n\nOutro <b>x</b>"))->toBe('<p>Um &amp; dois.<br>A mesma linha.</p><p>Outro &lt;b&gt;x&lt;/b&gt;</p>')
            ->and(LegacySheet::toHtml('<p>Já pronto</p>'))->toBe('<p>Já pronto</p>');
    });
});
