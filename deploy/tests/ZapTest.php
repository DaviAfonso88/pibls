<?php

declare(strict_types=1);

use Symfony\Component\Yaml\Yaml;

require_once __DIR__.'/helpers.php';

/*
| OWASP ZAP baseline semanal (T160): o arquivo de regras tem o formato do ZAP e o workflow só mira a homologação.
*/

const ZAP_ROOT = __DIR__.'/../..';

it('as regras do ZAP têm o formato id, ação e motivo, separados por tabulação, e a ação existe', function () {
    $lines = array_filter(explode("\n", (string) file_get_contents(ZAP_ROOT.'/deploy/zap/rules.tsv')), fn (string $line) => trim($line) !== '');

    expect($lines)->not->toBeEmpty();
    foreach ($lines as $line) {
        $columns = explode("\t", $line);

        expect(count($columns))->toBeGreaterThanOrEqual(3, "linha sem tabulação: {$line}")
            ->and($columns[0])->toMatch('/^\d+$/')
            ->and($columns[1])->toBeIn(['IGNORE', 'WARN', 'FAIL', 'INFO'])
            ->and(trim($columns[2]))->not->toBe('', "a regra {$columns[0]} precisa dizer por que foi aceita");
    }
});

it('o CSP com unsafe-inline continua como aviso (não some, não derruba) enquanto for débito técnico aceito', function () {
    expect((string) file_get_contents(ZAP_ROOT.'/deploy/zap/rules.tsv'))->toMatch("/^10055\tWARN\t/m");
});

it('o workflow do ZAP roda toda semana, só mira homologação, não usa segredo em texto e fixa as actions por commit', function () {
    // O container do Docker só monta backend, docs e deploy; no CI o repositório inteiro está lá
    if (! is_file(ZAP_ROOT.'/.github/workflows/zap.yml')) {
        $this->markTestSkipped('.github não está montado neste ambiente.');
    }

    $raw = (string) file_get_contents(ZAP_ROOT.'/.github/workflows/zap.yml');
    $workflow = Yaml::parse($raw);
    $triggers = $workflow['on'] ?? $workflow[true];

    expect($triggers['schedule'][0]['cron'])->toBe('0 12 * * 1')
        ->and($triggers)->toHaveKey('workflow_dispatch')
        ->and($workflow['permissions'])->toBe(['contents' => 'read'])
        ->and($workflow['jobs']['baseline']['environment']['name'])->toBe('homolog')
        ->and($raw)->toContain('https://homolog.')->toContain('nunca contra')
        ->and($raw)->not->toMatch('/BASIC_AUTH:\s*[^\s$]/');

    foreach ($workflow['jobs']['baseline']['steps'] as $step) {
        if (isset($step['uses'])) {
            expect($step['uses'])->toMatch('/@[0-9a-f]{40}$/');
        }
    }
});
