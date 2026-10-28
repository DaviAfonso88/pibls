<?php

declare(strict_types=1);

use Symfony\Component\Process\Process;
use Symfony\Component\Yaml\Yaml;

require_once __DIR__.'/helpers.php';

/*
| Lembretes da rotina de manutenção (T202, operação enxuta da ADR-021): o script escolhe os checklists do mês (mensal todo
| mês; anual em fevereiro), cada checklist existe e o workflow só pede o que precisa (escrever issues).
*/

const LEMBRETES_ROOT = __DIR__.'/../..';

/**
 * @param  array<string, string>  $env
 * @return array{exit: int, stdout: string, stderr: string}
 */
function lembretes(array $env = []): array
{
    $process = new Process(['bash', LEMBRETES_ROOT.'/deploy/ci/abrir-lembretes.sh'], null, $env + ['PATH' => (string) getenv('PATH'), 'DRY_RUN' => '1']);
    $process->setTimeout(30);
    $process->run();

    return ['exit' => (int) $process->getExitCode(), 'stdout' => trim($process->getOutput()), 'stderr' => $process->getErrorOutput()];
}

it('abre só o lembrete mensal em todos os meses, menos em fevereiro', function () {
    foreach (['01', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'] as $mes) {
        expect(lembretes(['MES' => $mes, 'ANO' => '2027'])['stdout'])->toBe("abriria: Manutenção mensal: 2027-{$mes}");
    }
});

it('em fevereiro abre também o anual, a janela de atualização', function () {
    expect(lembretes(['MES' => '02', 'ANO' => '2027'])['stdout'])
        ->toBe("abriria: Manutenção mensal: 2027-02\nabriria: Manutenção anual: 2027-02");
});

it('TIPOS escolhe os lembretes na mão, ignorando o mês', function () {
    expect(lembretes(['MES' => '03', 'ANO' => '2027', 'TIPOS' => 'anual,mensal'])['stdout'])
        ->toBe("abriria: Manutenção anual: 2027-03\nabriria: Manutenção mensal: 2027-03");
});

it('falha, sem abrir nada, se pedirem um lembrete que não existe (inclusive os da versão completa)', function () {
    foreach (['quinzenal', 'trimestral', 'semestral'] as $tipo) {
        $result = lembretes(['MES' => '03', 'ANO' => '2027', 'TIPOS' => $tipo]);

        expect($result['exit'])->toBe(1)->and($result['stderr'])->toContain("checklist do lembrete '{$tipo}'");
    }
});

it('todo checklist existe e traz itens para marcar', function () {
    foreach (['mensal' => 5, 'anual' => 7] as $tipo => $minimo) {
        $content = (string) file_get_contents(LEMBRETES_ROOT."/deploy/lembretes/{$tipo}.md");

        expect(substr_count($content, '- [ ]'))->toBeGreaterThanOrEqual($minimo, "o checklist {$tipo} está curto");
    }
});

it('o checklist anual inclui o teste de restauração (Constituição VII), o kit e a rotação de segredos', function () {
    $anual = (string) file_get_contents(LEMBRETES_ROOT.'/deploy/lembretes/anual.md');

    expect($anual)->toContain('Teste de restauração')->toContain('Kit de contingência')->toContain('Rotação de segredos');
});

it('o workflow roda no dia 1, só escreve issues e fixa as actions por commit', function () {
    // O container do Docker só monta backend, docs e deploy; no CI o repositório inteiro está lá
    if (! is_file(LEMBRETES_ROOT.'/.github/workflows/lembretes.yml')) {
        $this->markTestSkipped('.github não está montado neste ambiente.');
    }

    $workflow = Yaml::parseFile(LEMBRETES_ROOT.'/.github/workflows/lembretes.yml');

    // `on` vira `true` no YAML 1.1
    $triggers = $workflow['on'] ?? $workflow[true];

    expect($triggers['schedule'][0]['cron'])->toBe('0 11 1 * *')
        ->and($triggers)->toHaveKey('workflow_dispatch')
        ->and($workflow['permissions'])->toBe(['contents' => 'read', 'issues' => 'write']);

    foreach ($workflow['jobs']['abrir']['steps'] as $step) {
        if (isset($step['uses'])) {
            expect($step['uses'])->toMatch('/@[0-9a-f]{40}$/');
        }
    }
});
