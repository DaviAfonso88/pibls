<?php

declare(strict_types=1);

use Symfony\Component\Process\Process;

require_once __DIR__.'/helpers.php';

/*
| Scripts do pipeline de CD (deploy/ci/*.sh): janela de deploy, conteúdo provisório, envio por FTPS, espera do status,
| rollback e conferência do /api/health. O `lftp` é substituído por um falso que registra o que recebeu.
*/

const CI_DIR = __DIR__.'/../ci';

/**
 * @param  list<string>  $arguments
 * @param  array<string, string>  $env
 * @return array{exit: int, stdout: string, stderr: string}
 */
function script(string $name, array $arguments = [], array $env = []): array
{
    $process = new Process(['bash', CI_DIR."/{$name}.sh", ...$arguments], null, $env + ['PATH' => (string) getenv('PATH')]);
    $process->setTimeout(60);
    $process->run();

    return ['exit' => (int) $process->getExitCode(), 'stdout' => $process->getOutput(), 'stderr' => $process->getErrorOutput()];
}

afterEach(function () {
    foreach ($this->scratch ?? [] as $path) {
        removeTree($path);
    }
});

// ---------------------------------------------------------------------------------------------------------------
// check-window.sh
// ---------------------------------------------------------------------------------------------------------------

it('a janela de produção é de segunda a quarta, das 9h às 18h (America/Sao_Paulo)', function (string $now, bool $allowed) {
    $result = script('check-window', env: ['DEPLOY_NOW' => $now]);

    expect($result['exit'])->toBe($allowed ? 0 : 1, $result['stdout']);
})->with([
    'segunda 09:00' => ['2026-11-02 09:00 -0300', true],
    'segunda 08:59' => ['2026-11-02 08:59 -0300', false],
    'segunda 10:00' => ['2026-11-02 10:00 -0300', true],
    'terça 14:30' => ['2026-11-03 14:30 -0300', true],
    'quarta 17:59' => ['2026-11-04 17:59 -0300', true],
    'quarta 18:00' => ['2026-11-04 18:00 -0300', false],
    'quinta 10:00' => ['2026-11-05 10:00 -0300', false],
    'sexta 10:00' => ['2026-11-06 10:00 -0300', false],
    'sábado 10:00' => ['2026-11-07 10:00 -0300', false],
    'domingo 10:00' => ['2026-11-08 10:00 -0300', false],
    'segunda 00:30' => ['2026-11-02 00:30 -0300', false],
    'o fuso é o de São Paulo: 12:00 UTC é 09:00' => ['2026-11-02 12:00 UTC', true],
    'o fuso é o de São Paulo: 11:59 UTC é 08:59' => ['2026-11-02 11:59 UTC', false],
    'o fuso é o de São Paulo: 21:00 UTC é 18:00' => ['2026-11-02 21:00 UTC', false],
    'terça 02:00 UTC ainda é segunda à noite em SP' => ['2026-11-03 02:00 UTC', false],
]);

it('fora da janela só passa como hotfix, com justificativa', function (array $env, bool $allowed) {
    $result = script('check-window', env: ['DEPLOY_NOW' => '2026-11-07 10:00 -0300'] + $env);

    expect($result['exit'])->toBe($allowed ? 0 : 1)
        ->and($result['stdout'])->toContain($allowed ? '::warning::Deploy FORA da janela' : '::error::Fora da janela');
})->with([
    'hotfix com justificativa' => [['HOTFIX' => 'true', 'JUSTIFICATION' => 'PIX com chave errada no ar'], true],
    'hotfix sem justificativa' => [['HOTFIX' => 'true', 'JUSTIFICATION' => ''], false],
    'hotfix com justificativa só de espaços' => [['HOTFIX' => 'true', 'JUSTIFICATION' => "  \n "], false],
    'justificativa sem hotfix' => [['HOTFIX' => 'false', 'JUSTIFICATION' => 'preciso'], false],
    'sem nada' => [[], false],
]);

// ---------------------------------------------------------------------------------------------------------------
// check-no-provisional-content.sh
// ---------------------------------------------------------------------------------------------------------------

it('bloqueia a produção se houver marcador TODO(TBD-…) no conteúdo', function () {
    $this->scratch[] = $root = scratchDir('pibls-ci');
    put("{$root}/backend/database/data/initial_content.php", "<?php\n'street' => 'TODO(TBD-11)',\n");
    put("{$root}/frontend/app/content/quem-somos.ts", "export const x = 'ok';\n");

    $result = script('check-no-provisional-content', ["{$root}/backend/database/data", "{$root}/frontend/app/content"]);

    expect($result['exit'])->toBe(1)
        ->and($result['stdout'])->toContain('::error::Conteúdo provisório')->toContain('initial_content.php:2')->toContain('TODO(TBD-11)')
        ->and($result['stdout'])->not->toContain('quem-somos.ts');
});

it('acha o marcador em qualquer nível de pasta e em qualquer tipo de arquivo', function (string $file) {
    $this->scratch[] = $root = scratchDir('pibls-ci');
    put("{$root}/conteudo/{$file}", "linha 1\nTODO(TBD-06) texto provisório\n");

    expect(script('check-no-provisional-content', ["{$root}/conteudo"])['exit'])->toBe(1);
})->with(['a.php', 'fundo/b.ts', 'fundo/mais/c.md', 'd.json']);

it('passa sem marcador, com pasta inexistente ou vazia', function () {
    $this->scratch[] = $root = scratchDir('pibls-ci');
    put("{$root}/conteudo/ok.ts", "export const idade = 41; // TODO sem identificador\n");
    mkdir("{$root}/vazia");

    $result = script('check-no-provisional-content', ["{$root}/conteudo", "{$root}/vazia", "{$root}/nao-existe"]);

    expect($result['exit'])->toBe(0)->and($result['stdout'])->toContain('Nenhum marcador');
});

// ---------------------------------------------------------------------------------------------------------------
// next-release-id.sh
// ---------------------------------------------------------------------------------------------------------------

it('o id da release vem da tag vAAAA.MM.N ou de ano.mês.número-da-execução', function (array $env, ?string $expected) {
    $result = script('next-release-id', env: $env);

    if ($expected === null) {
        expect($result['exit'])->toBe(1)->and($result['stderr'])->toContain('inválido');

        return;
    }

    expect($result['exit'])->toBe(0, $result['stderr'])->and(trim($result['stdout']))->toBe("release_id={$expected}");
})->with([
    'tag' => [['GITHUB_REF' => 'refs/tags/v2026.11.3'], '2026.11.3'],
    'branch main' => [['GITHUB_REF' => 'refs/heads/main', 'GITHUB_RUN_NUMBER' => '57'], gmdate('Y.m').'.57'],
    'tag fora do padrão' => [['GITHUB_REF' => 'refs/tags/v1.0.0'], null],
    'tag com mês inválido' => [['GITHUB_REF' => 'refs/tags/v2026.13.1'], null],
    'tag com sufixo' => [['GITHUB_REF' => 'refs/tags/v2026.11.3-rc1'], null],
]);

// ---------------------------------------------------------------------------------------------------------------
// wait-for-status.sh
// ---------------------------------------------------------------------------------------------------------------

function statusDir(object $test, array $status, string $id = '2026.11.1'): string
{
    $test->scratch[] = $dir = scratchDir('pibls-ci');
    put("{$dir}/{$id}.json", json_encode($status));

    return $dir;
}

function waitFor(string $dir, array $arguments = ['2026.11.1'], array $env = []): array
{
    return script('wait-for-status', $arguments, $env + ['STATUS_SOURCE_DIR' => $dir, 'WAIT_TIMEOUT_SECONDS' => '3', 'POLL_INTERVAL_SECONDS' => '1']);
}

it('sai 0 quando a release ficou ativa', function () {
    $dir = statusDir($this, ['release_id' => '2026.11.1', 'state' => 'active', 'step' => 'done', 'updated_at' => '2026-11-02T12:00:00Z']);

    $result = waitFor($dir);

    expect($result['exit'])->toBe(0)->and($result['stderr'])->toContain('Release 2026.11.1 ativa.');
});

it('sai 1 com a etapa e a mensagem quando a ativação falhou', function () {
    $dir = statusDir($this, [
        'release_id' => '2026.11.1', 'state' => 'failed', 'step' => 'migrate', 'message' => 'As migrations falharam.',
        'output_tail' => 'SQLSTATE[42S01]: tabela já existe', 'updated_at' => '2026-11-02T12:00:00Z',
    ]);

    $result = waitFor($dir);

    expect($result['exit'])->toBe(1)
        ->and($result['stdout'])->toContain("::error::A ativação de 2026.11.1 falhou na etapa 'migrate': As migrations falharam.")
        ->and($result['stderr'])->toContain('SQLSTATE[42S01]');
});

it('sai 1 por tempo esgotado se o ativador nunca responde ou ainda está rodando', function (?array $status) {
    $dir = statusDir($this, $status ?? ['state' => 'running', 'step' => 'migrate']);
    if ($status === null) {
        unlink("{$dir}/2026.11.1.json"); // nunca apareceu
    }

    $result = waitFor($dir);

    expect($result['exit'])->toBe(1)->and($result['stdout'])->toContain('Tempo esgotado');
})->with(['ainda rodando' => [['state' => 'running', 'step' => 'migrate']], 'sem arquivo' => [null]]);

it('ignora um status ilegível e continua esperando', function () {
    $this->scratch[] = $dir = scratchDir('pibls-ci');
    put("{$dir}/2026.11.1.json", '{"state": "act');

    expect(waitFor($dir)['exit'])->toBe(1);
});

it('no rollback, o status "active" antigo da mesma release não vale como resposta', function () {
    $dir = statusDir($this, ['state' => 'active', 'step' => 'done', 'updated_at' => '2026-11-01T10:00:00Z']);

    $result = waitFor($dir, ['2026.11.1', '--rollback', '--since', '2026-11-02T12:00:00Z']);

    expect($result['exit'])->toBe(1)->and($result['stdout'])->toContain('Tempo esgotado');
});

it('no rollback, só vale o status via=rollback atualizado depois do pedido', function () {
    $dir = statusDir($this, ['state' => 'active', 'step' => 'done', 'via' => 'rollback', 'updated_at' => '2026-11-02T12:05:00Z']);

    $result = waitFor($dir, ['2026.11.1', '--rollback', '--since', '2026-11-02T12:00:00Z']);

    expect($result['exit'])->toBe(0);
});

it('no rollback, uma falha nova também encerra a espera', function () {
    $dir = statusDir($this, ['state' => 'failed', 'step' => 'rollback', 'message' => 'A release não existe mais.', 'updated_at' => '2026-11-02T12:05:00Z']);

    $result = waitFor($dir, ['2026.11.1', '--rollback', '--since', '2026-11-02T12:00:00Z']);

    expect($result['exit'])->toBe(1)->and($result['stdout'])->toContain('A release não existe mais.');
});

it('no rollback, uma falha antiga não encerra a espera', function () {
    $dir = statusDir($this, ['state' => 'failed', 'step' => 'migrate', 'updated_at' => '2026-11-01T10:00:00Z']);

    $result = waitFor($dir, ['2026.11.1', '--rollback', '--since', '2026-11-02T12:00:00Z']);

    expect($result['stdout'])->toContain('Tempo esgotado');
});

it('recusa argumento desconhecido', function () {
    expect(script('wait-for-status', ['2026.11.1', '--quem-sabe'], ['STATUS_SOURCE_DIR' => '/tmp'])['exit'])->toBe(2);
});

// ---------------------------------------------------------------------------------------------------------------
// upload-release.sh e request-rollback.sh (com um lftp falso)
// ---------------------------------------------------------------------------------------------------------------

/** Cria uma pasta bin/ com um `lftp` falso e devolve o ambiente que o usa. @return array<string, string> */
function fakeLftp(object $test, array $remoteFiles = []): array
{
    $test->scratch[] = $root = scratchDir('pibls-ci');
    put("{$root}/bin/lftp", <<<'BASH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_LFTP_LOG"
script="${@: -1}"
if [[ "$script" =~ get\ ([^\ ]+)\ -o\ \'([^\']+)\' ]]; then
  source_file="${BASH_REMATCH[1]}"; target="${BASH_REMATCH[2]}"
  if [ -f "$FAKE_REMOTE/$source_file" ]; then cp "$FAKE_REMOTE/$source_file" "$target"; else exit 1; fi
fi
exit 0
BASH);
    chmod("{$root}/bin/lftp", 0755);
    mkdir("{$root}/remote", 0755, true);
    foreach ($remoteFiles as $path => $content) {
        put("{$root}/remote/{$path}", $content);
    }

    return [
        'PATH' => "{$root}/bin:".getenv('PATH'),
        'FAKE_LFTP_LOG' => "{$root}/lftp.log",
        'FAKE_REMOTE' => "{$root}/remote",
        'FTP_HOST' => 'ftp.exemplo.test',
        'FTP_USER' => 'deploy',
        'FTP_PASSWORD' => 'senha-secreta-do-ftp',
        'GITHUB_OUTPUT' => "{$root}/output.txt",
    ];
}

function lftpCalls(array $env): array
{
    return is_file($env['FAKE_LFTP_LOG']) ? array_values(array_filter(explode("\n", (string) file_get_contents($env['FAKE_LFTP_LOG'])))) : [];
}

it('o upload envia o pacote primeiro, o manifest por último, ambos com nome temporário e renomeados, por FTPS', function () {
    $env = fakeLftp($this);
    $this->scratch[] = $out = scratchDir('pibls-ci');
    put("{$out}/release-2026.11.1.tar.gz", 'pacote');
    put("{$out}/manifest.json", '{}');

    $result = script('upload-release', [$out, '2026.11.1'], $env);

    $calls = lftpCalls($env);
    expect($result['exit'])->toBe(0, $result['stderr'])
        ->and($calls)->toHaveCount(2)
        ->and($calls[0])->toContain('release-2026.11.1.tar.gz.part')->toContain("mv 'release-2026.11.1.tar.gz.part' 'release-2026.11.1.tar.gz'")
        ->and($calls[1])->toContain('manifest.json.part')->toContain('mv manifest.json.part manifest.json')
        ->and($calls[0])->not->toContain('manifest.json')
        ->and($calls[0])->toContain('ftp:ssl-force true')->toContain('ftp:ssl-protect-data true')->toContain('ssl:verify-certificate yes')
        ->and($calls[0])->toContain('ftp://ftp.exemplo.test')->toContain('cd inbox')
        ->and($result['stdout'].$result['stderr'])->not->toContain('senha-secreta-do-ftp');
});

it('o upload não envia nada se faltar o pacote ou o manifest', function (string $missing) {
    $env = fakeLftp($this);
    $this->scratch[] = $out = scratchDir('pibls-ci');
    put("{$out}/release-2026.11.1.tar.gz", 'pacote');
    put("{$out}/manifest.json", '{}');
    unlink("{$out}/{$missing}");

    $result = script('upload-release', [$out, '2026.11.1'], $env);

    expect($result['exit'])->toBe(1)->and(lftpCalls($env))->toBe([]);
})->with(['release-2026.11.1.tar.gz', 'manifest.json']);

it('o rollback pedido sem id usa a release anterior de status/current.json', function () {
    $env = fakeLftp($this, ['status/current.json' => json_encode(['release_id' => '2026.11.2', 'previous_release_id' => '2026.11.1'])]);

    $result = script('request-rollback', [], $env);

    $output = (string) file_get_contents($env['GITHUB_OUTPUT']);
    expect($result['exit'])->toBe(0, $result['stderr'])
        ->and($output)->toContain('release_id=2026.11.1')->toMatch('/requested_at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/')
        ->and(implode("\n", lftpCalls($env)))->toContain('rollback.json.part')->toContain('mv rollback.json.part rollback.json');
});

it('o rollback pedido com id usa o id informado, sem consultar o servidor', function () {
    $env = fakeLftp($this);

    $result = script('request-rollback', ['2026.10.4'], $env);

    expect($result['exit'])->toBe(0)->and(file_get_contents($env['GITHUB_OUTPUT']))->toContain('release_id=2026.10.4')
        ->and(lftpCalls($env))->toHaveCount(1); // só o upload; nenhum `get`
});

it('o rollback recusa id inválido e a falta de release anterior, sem enviar nada', function (array $remote, array $arguments) {
    $env = fakeLftp($this, $remote);

    $result = script('request-rollback', $arguments, $env);

    expect($result['exit'])->toBe(1)
        ->and(implode("\n", lftpCalls($env)))->not->toContain('rollback.json');
})->with([
    'id fora do padrão' => [[], ['../../etc']],
    'mês inválido' => [[], ['2026.13.1']],
    'sem anterior registrada' => [['status/current.json' => json_encode(['release_id' => '2026.11.1', 'previous_release_id' => null])], []],
    'sem status/current.json' => [[], []],
]);

// ---------------------------------------------------------------------------------------------------------------
// verify-health.sh (com um servidor PHP de verdade)
// ---------------------------------------------------------------------------------------------------------------

function healthServer(object $test, int $status, string $body, ?string $requireAuth = null): array
{
    $test->scratch[] = $root = scratchDir('pibls-ci');
    $auth = var_export($requireAuth, true);
    put("{$root}/router.php", <<<PHP
<?php
\$required = {$auth};
if (\$required !== null && (\$_SERVER['PHP_AUTH_USER'] ?? '').':'.(\$_SERVER['PHP_AUTH_PW'] ?? '') !== \$required) {
    http_response_code(401);
    exit;
}
http_response_code({$status});
header('Content-Type: application/json');
echo '{$body}';
PHP);

    $port = random_int(20000, 40000);
    $server = new Process([PHP_BINARY, '-S', "127.0.0.1:{$port}", "{$root}/router.php"]);
    $server->start();
    // O servidor embutido avisa na saída de erro quando está pronto; abrir socket para testar geraria warnings
    for ($i = 0; $i < 50 && ! str_contains($server->getErrorOutput(), 'Development Server'); $i++) {
        usleep(100_000);
    }

    return ['url' => "http://127.0.0.1:{$port}", 'server' => $server];
}

it('o health check confere 200, status ok e a release esperada', function () {
    ['url' => $url, 'server' => $server] = healthServer($this, 200, '{"status":"ok","release":"2026.11.1"}');

    try {
        $result = script('verify-health', [$url, '2026.11.1']);
    } finally {
        $server->stop();
    }

    expect($result['exit'])->toBe(0, $result['stderr'])->and($result['stdout'])->toContain('Health OK');
});

it('o health check falha se a release for outra, se o status não for ok ou se der 503', function (int $status, string $body) {
    ['url' => $url, 'server' => $server] = healthServer($this, $status, $body);

    try {
        $result = script('verify-health', [$url, '2026.11.1'], ['HEALTH_RETRY_SECONDS' => '0']);
    } finally {
        $server->stop();
    }

    expect($result['exit'])->toBe(1)->and($result['stdout'])->toContain('::error::');
})->with([
    'release anterior ainda no ar' => [200, '{"status":"ok","release":"2026.10.9"}'],
    'status degradado' => [503, '{"status":"degraded"}'],
    'corpo vazio' => [200, '{}'],
]);

it('o health check passa o Basic Auth da homologação', function () {
    ['url' => $url, 'server' => $server] = healthServer($this, 200, '{"status":"ok","release":"2026.11.1"}', 'equipe:segredo');

    try {
        $semSenha = script('verify-health', [$url, '2026.11.1'], ['HEALTH_RETRY_SECONDS' => '0']);
        $comSenha = script('verify-health', [$url, '2026.11.1'], ['BASIC_AUTH' => 'equipe:segredo']);
    } finally {
        $server->stop();
    }

    expect($semSenha['exit'])->toBe(1)->and($comSenha['exit'])->toBe(0, $comSenha['stderr']);
});
