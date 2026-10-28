<?php

declare(strict_types=1);

use Symfony\Component\Process\Process;

/*
| Ativador de release (deploy/finalize.php): ADR-010 e DevOps → Ativador.
|
| Cada teste monta um servidor falso numa pasta temporária (`private/pibls/…` e `public_html/`), gera um pacote de
| release de verdade com `build-release-package.php` e roda o `finalize.php` como o cron faria. O "Laravel" de cada
| release é um `artisan` de mentira, que registra o que o ativador pediu e falha quando o teste manda.
*/

require_once __DIR__.'/helpers.php';
require_once dirname(__DIR__).'/build-release-package.php';

const FINALIZE = __DIR__.'/../finalize.php';

const FAKE_ARTISAN = <<<'PHP'
<?php
// artisan de mentira: registra a chamada e falha se o comando estiver em fail.txt
$shared = getenv('PIBLS_SHARED_PATH') ?: '';
file_put_contents($shared.'/calls.log', implode(' ', array_slice($argv, 1))."\n", FILE_APPEND);
$failing = array_filter(array_map('trim', explode("\n", (string) @file_get_contents(__DIR__.'/fail.txt'))));
if (($argv[1] ?? '') === 'pibls:doctor') {
    echo json_encode(['status' => in_array('pibls:doctor', $failing, true) ? 'error' : 'ok', 'checks' => []]), "\n";
} else {
    echo "executando {$argv[1]}\n";
}
exit(in_array($argv[1] ?? '', $failing, true) ? 1 : 0);
PHP;

const HTACCESS_BLOCK = "# BEGIN pibls\nRewriteEngine On\nRewriteRule ^api/ index.php [L]\n# END pibls\n";

const CPANEL_HANDLER = "# php -- BEGIN cPanel-generated handler, do not edit\n<IfModule mime_module>\n  AddHandler application/x-httpd-ea-php84___lsphp .php\n</IfModule>\n# php -- END cPanel-generated handler, do not edit\n";

/** Servidor falso: a pasta da conta (`home`) com `private/pibls/` e o docroot, que já tem o que o deploy não pode tocar. */
function newServer(): array
{
    $home = sys_get_temp_dir().'/pibls-deploy-'.bin2hex(random_bytes(4));
    $base = "{$home}/private/pibls";
    foreach (['deploy/inbox', 'deploy/status', 'deploy/lock', 'releases', 'shared/storage/logs'] as $directory) {
        mkdir("{$base}/{$directory}", 0755, true);
    }
    put("{$base}/shared/.env", "APP_ENV=production\n");

    $docroot = "{$home}/public_html";
    put("{$docroot}/uploads/boletins/2026/ficha.pdf", 'PDF DO USUARIO');
    put("{$docroot}/uploads/.htaccess", "Options -Indexes\n");
    put("{$docroot}/data/settings.json", '{"gerado":"pelo backend"}');
    put("{$docroot}/.well-known/acme-challenge/token", 'TOKEN-AUTOSSL');
    put("{$docroot}/cgi-bin/ping.cgi", 'CGI-DO-CPANEL');
    put("{$docroot}/.htaccess", CPANEL_HANDLER);

    return ['home' => $home, 'base' => $base, 'docroot' => $docroot, 'inbox' => "{$base}/deploy/inbox", 'status' => "{$base}/deploy/status"];
}

/**
 * Monta e coloca na caixa de entrada o pacote de uma release (o pacote primeiro, o manifest por último).
 *
 * @param  array{fail?: list<string>, htaccess?: string|null, extraSpaFiles?: array<string, string>, version?: string}  $options
 * @return array{id: string, package: string, manifest: string}
 */
function stageRelease(array $server, string $id, array $options = []): array
{
    $staging = $server['home'].'/staging-'.$id;
    removeTree($staging);

    $version = $options['version'] ?? $id;
    put("{$staging}/backend/artisan", FAKE_ARTISAN);
    put("{$staging}/backend/vendor/autoload.php", "<?php // vendor\n");
    put("{$staging}/backend/fail.txt", implode("\n", $options['fail'] ?? [])."\n");
    put("{$staging}/spa/index.html", "<html>inicio {$version}</html>");
    put("{$staging}/spa/__spa-fallback.html", "<html>fallback {$version}</html>");
    put("{$staging}/spa/quem-somos.html", "<html>quem somos {$version}</html>");
    put("{$staging}/spa/assets/app-{$version}.js", "console.log('{$version}')");
    put("{$staging}/spa/robots.txt", 'User-agent: *');
    if (($options['htaccess'] ?? HTACCESS_BLOCK) !== null) {
        put("{$staging}/spa/.htaccess", $options['htaccess'] ?? HTACCESS_BLOCK);
    }
    foreach ($options['extraSpaFiles'] ?? [] as $path => $content) {
        put("{$staging}/spa/{$path}", $content);
    }

    $built = buildReleasePackage($staging, $id, 'abc1234', "{$server['home']}/out-{$id}");
    copy($built['package'], "{$server['inbox']}/".basename($built['package']));
    copy($built['manifest'], "{$server['inbox']}/manifest.json");

    return ['id' => $id, 'package' => "{$server['inbox']}/".basename($built['package']), 'manifest' => "{$server['inbox']}/manifest.json"];
}

/** @return array{exit: int, output: string} */
function finalize(array $server): array
{
    $process = new Process([PHP_BINARY, FINALIZE, 'pibls', "--home={$server['home']}"]);
    $process->run();

    return ['exit' => (int) $process->getExitCode(), 'output' => $process->getOutput().$process->getErrorOutput()];
}

function activeRelease(array $server): ?string
{
    $pointer = "{$server['base']}/current.php";

    return is_file($pointer) && preg_match("/'releases\\/([^']+)'/", (string) file_get_contents($pointer), $m) === 1 ? $m[1] : null;
}

/** @return array<string, mixed> */
function statusOf(array $server, string $id): array
{
    return json_decode((string) file_get_contents("{$server['status']}/{$id}.json"), true, flags: JSON_THROW_ON_ERROR);
}

/** @return list<string> o que o ativador pediu ao artisan, na ordem */
function artisanCalls(array $server): array
{
    $log = "{$server['base']}/shared/calls.log";

    return is_file($log) ? array_values(array_filter(explode("\n", (string) file_get_contents($log)))) : [];
}

function inboxFiles(array $server): array
{
    return array_values(array_diff(scandir($server['inbox']) ?: [], ['.', '..']));
}

beforeEach(function () {
    $this->server = newServer();
});

afterEach(function () {
    removeTree($this->server['home']);
});

it('ativa uma release: ponteiro, assets, html, robots, bloco do .htaccess e status', function () {
    stageRelease($this->server, '2026.11.1');

    $result = finalize($this->server);

    expect($result['exit'])->toBe(0, $result['output'])
        ->and(activeRelease($this->server))->toBe('2026.11.1')
        ->and(file_get_contents($this->server['base'].'/current.php'))->toBe("<?php return 'releases/2026.11.1';\n")
        ->and(file_get_contents($this->server['docroot'].'/index.html'))->toBe('<html>inicio 2026.11.1</html>')
        ->and(file_get_contents($this->server['docroot'].'/quem-somos.html'))->toBe('<html>quem somos 2026.11.1</html>')
        ->and(file_get_contents($this->server['docroot'].'/__spa-fallback.html'))->toBe('<html>fallback 2026.11.1</html>')
        ->and(file_get_contents($this->server['docroot'].'/assets/app-2026.11.1.js'))->toBe("console.log('2026.11.1')")
        ->and(file_get_contents($this->server['docroot'].'/robots.txt'))->toBe('User-agent: *')
        ->and(is_dir($this->server['base'].'/releases/2026.11.1/backend'))->toBeTrue()
        ->and(is_file($this->server['base'].'/releases/2026.11.1/spa/index.html'))->toBeTrue()
        ->and(is_file($this->server['base'].'/releases/2026.11.1/manifest.json'))->toBeTrue()
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['release_id' => '2026.11.1', 'state' => 'active', 'step' => 'done', 'git_sha' => 'abc1234', 'app' => 'pibls'])
        ->and(json_decode((string) file_get_contents($this->server['status'].'/current.json'), true))->toMatchArray(['release_id' => '2026.11.1', 'previous_release_id' => null]);
});

it('esvazia a caixa de entrada depois de ativar', function () {
    stageRelease($this->server, '2026.11.1');
    expect(inboxFiles($this->server))->toBe(['manifest.json', 'release-2026.11.1.tar.gz']);

    finalize($this->server);

    expect(inboxFiles($this->server))->toBe([]);
});

it('roda doctor, migrate (com o usuário de DDL), optimize e a pós-ativação, nesta ordem, com o .env compartilhado', function () {
    stageRelease($this->server, '2026.11.1');

    finalize($this->server);

    expect(artisanCalls($this->server))->toBe([
        'pibls:doctor --json',
        'migrate --force --database=migrator',
        'optimize',
        'pibls:release:activated 2026.11.1',
    ]);
});

it('nunca toca uploads/, data/, .well-known/ nem cgi-bin/', function () {
    stageRelease($this->server, '2026.11.1', ['extraSpaFiles' => ['uploads/malicioso.php' => '<?php evil();', 'data/settings.json' => '{"do":"pacote"}', '.well-known/x' => 'x', 'cgi-bin/y' => 'y']]);

    $result = finalize($this->server);

    $docroot = $this->server['docroot'];
    expect($result['exit'])->toBe(0, $result['output'])
        ->and(file_exists("{$docroot}/uploads/malicioso.php"))->toBeFalse()
        ->and(file_get_contents("{$docroot}/uploads/boletins/2026/ficha.pdf"))->toBe('PDF DO USUARIO')
        ->and(file_get_contents("{$docroot}/uploads/.htaccess"))->toBe("Options -Indexes\n")
        ->and(file_get_contents("{$docroot}/data/settings.json"))->toBe('{"gerado":"pelo backend"}')
        ->and(file_get_contents("{$docroot}/.well-known/acme-challenge/token"))->toBe('TOKEN-AUTOSSL')
        ->and(file_exists("{$docroot}/.well-known/x"))->toBeFalse()
        ->and(file_get_contents("{$docroot}/cgi-bin/ping.cgi"))->toBe('CGI-DO-CPANEL')
        ->and(file_exists("{$docroot}/cgi-bin/y"))->toBeFalse();
});

it('troca só o bloco do .htaccess e preserva o que o cPanel escreveu', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);

    $htaccess = (string) file_get_contents($this->server['docroot'].'/.htaccess');
    expect($htaccess)->toContain(CPANEL_HANDLER)->toContain(HTACCESS_BLOCK)
        ->and(substr_count($htaccess, '# BEGIN pibls'))->toBe(1);

    // Uma segunda release com o bloco alterado substitui o anterior, sem duplicar
    stageRelease($this->server, '2026.11.2', ['htaccess' => "# BEGIN pibls\nRewriteEngine On\nRewriteRule ^sitemap\\.xml$ index.php [L]\n# END pibls\n"]);
    finalize($this->server);

    $htaccess = (string) file_get_contents($this->server['docroot'].'/.htaccess');
    expect($htaccess)->toContain(CPANEL_HANDLER)->toContain('sitemap')->not->toContain('RewriteRule ^api/')
        ->and(substr_count($htaccess, '# BEGIN pibls'))->toBe(1)
        ->and(substr_count($htaccess, '# php -- BEGIN cPanel-generated handler'))->toBe(1);
});

it('os marcadores do .htaccess só valem sozinhos na linha: citados num comentário não confundem a mescla', function () {
    $block = fn (string $rule) => "# BEGIN pibls\n# nota: os marcadores \"# BEGIN pibls\" e \"# END pibls\" abrem e fecham o bloco\n{$rule}\n# END pibls\n";
    stageRelease($this->server, '2026.11.1', ['htaccess' => $block('RewriteRule ^um$ index.php [L]')]);
    finalize($this->server);
    stageRelease($this->server, '2026.11.2', ['htaccess' => $block('RewriteRule ^dois$ index.php [L]')]);

    $result = finalize($this->server);

    $htaccess = (string) file_get_contents($this->server['docroot'].'/.htaccess');
    expect($result['exit'])->toBe(0, $result['output'])
        ->and($htaccess)->toContain('RewriteRule ^dois$')->not->toContain('RewriteRule ^um$')
        ->and(preg_match_all('/^# BEGIN pibls$/m', $htaccess))->toBe(1)
        ->and(preg_match_all('/^# END pibls$/m', $htaccess))->toBe(1)
        ->and(substr_count($htaccess, '# php -- BEGIN cPanel-generated handler'))->toBe(1);
});

it('.htaccess com os marcadores repetidos ou ausentes é recusado na publicação', function (string $htaccess) {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1', ['htaccess' => $htaccess]);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(statusOf($this->server, '2026.11.1')['step'])->toBe('publish');
    expectBaselineIntact($this->server);
})->with([
    'só o início' => ["# BEGIN pibls\nRewriteEngine On\n"],
    'só o fim' => ["RewriteEngine On\n# END pibls\n"],
    'dois blocos' => ["# BEGIN pibls\na\n# END pibls\n# BEGIN pibls\nb\n# END pibls\n"],
]);

it('uma segunda release troca o ponteiro, guarda a anterior e mantém os assets antigos', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);
    stageRelease($this->server, '2026.11.2');

    $result = finalize($this->server);

    expect($result['exit'])->toBe(0, $result['output'])
        ->and(activeRelease($this->server))->toBe('2026.11.2')
        ->and(file_get_contents($this->server['docroot'].'/index.html'))->toBe('<html>inicio 2026.11.2</html>')
        ->and(file_exists($this->server['docroot'].'/assets/app-2026.11.1.js'))->toBeTrue() // uma aba aberta ainda precisa deles
        ->and(file_exists($this->server['docroot'].'/assets/app-2026.11.2.js'))->toBeTrue()
        ->and(json_decode((string) file_get_contents($this->server['status'].'/current.json'), true))
        ->toMatchArray(['release_id' => '2026.11.2', 'previous_release_id' => '2026.11.1'])
        ->and(statusOf($this->server, '2026.11.2')['previous_release_id'])->toBe('2026.11.1');
});

it('não sobrescreve arquivos idênticos nem deixa temporários para trás', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);
    $asset = $this->server['docroot'].'/assets/app-2026.11.1.js';
    $mtime = filemtime($asset);
    touch($asset, $mtime - 1000);
    clearstatcache();

    stageRelease($this->server, '2026.11.2', ['version' => '2026.11.1']); // mesmo asset, mesmo conteúdo
    finalize($this->server);
    clearstatcache();

    expect(filemtime($asset))->toBe($mtime - 1000);
    $leftovers = glob($this->server['docroot'].'/{,assets/}*.tmp-*', GLOB_BRACE);
    expect($leftovers)->toBe([])->and(glob($this->server['base'].'/current.php.tmp*'))->toBe([]);
});

// ---------------------------------------------------------------------------------------------------------------
// Falhas: a release anterior continua ativa
// ---------------------------------------------------------------------------------------------------------------

function installBaseline(array $server): void
{
    stageRelease($server, '2026.10.1');
    expect(finalize($server)['exit'])->toBe(0);
    @unlink("{$server['base']}/shared/calls.log");
}

function expectBaselineIntact(array $server): void
{
    expect(activeRelease($server))->toBe('2026.10.1')
        ->and(file_get_contents($server['docroot'].'/index.html'))->toBe('<html>inicio 2026.10.1</html>');
}

it('checksum inválido: mantém a release anterior, não extrai nada e esvazia a caixa de entrada', function () {
    installBaseline($this->server);
    $release = stageRelease($this->server, '2026.11.1');
    $bytes = (string) file_get_contents($release['package']);
    file_put_contents($release['package'], substr_replace($bytes, 'X', 40, 1)); // um byte adulterado

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['state' => 'failed', 'step' => 'checksum'])
        ->and(is_dir($this->server['base'].'/releases/2026.11.1'))->toBeFalse()
        ->and(artisanCalls($this->server))->toBe([])
        ->and(inboxFiles($this->server))->toBe([]);
    expectBaselineIntact($this->server);
});

it('pacote que não chegou inteiro: mantém a release anterior', function () {
    installBaseline($this->server);
    $release = stageRelease($this->server, '2026.11.1');
    unlink($release['package']);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(statusOf($this->server, '2026.11.1')['step'])->toBe('checksum');
    expectBaselineIntact($this->server);
});

it('pibls:doctor com erro: mantém a release anterior e não migra', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1', ['fail' => ['pibls:doctor']]);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['state' => 'failed', 'step' => 'doctor'])
        ->and(statusOf($this->server, '2026.11.1')['output_tail'])->toContain('"status":"error"')
        ->and(artisanCalls($this->server))->toBe(['pibls:doctor --json'])
        ->and(inboxFiles($this->server))->toBe([]);
    expectBaselineIntact($this->server);
});

it('migrate com erro: mantém a release anterior, não publica nada e não roda optimize', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1', ['fail' => ['migrate']]);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['state' => 'failed', 'step' => 'migrate'])
        ->and(artisanCalls($this->server))->toBe(['pibls:doctor --json', 'migrate --force --database=migrator'])
        ->and(file_exists($this->server['docroot'].'/assets/app-2026.11.1.js'))->toBeFalse();
    expectBaselineIntact($this->server);
});

it('optimize com erro: mantém a release anterior e não publica nada', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1', ['fail' => ['optimize']]);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)
        ->and(statusOf($this->server, '2026.11.1')['step'])->toBe('optimize')
        ->and(file_exists($this->server['docroot'].'/assets/app-2026.11.1.js'))->toBeFalse();
    expectBaselineIntact($this->server);
});

it('.htaccess sem os marcadores: falha na publicação e mantém o ponteiro', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1', ['htaccess' => "RewriteEngine On\n"]);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(statusOf($this->server, '2026.11.1')['step'])->toBe('publish');
    expect(activeRelease($this->server))->toBe('2026.10.1');
});

it('o pós-ativação com erro não desfaz a ativação, só fica no status', function () {
    stageRelease($this->server, '2026.11.1', ['fail' => ['pibls:release:activated']]);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(0)
        ->and(activeRelease($this->server))->toBe('2026.11.1')
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['state' => 'active', 'post_activation_ok' => false]);
});

it('recusa pacote cujo conteúdo difere do manifest (arquivo a mais ou a menos)', function (string $mutation) {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1');
    $manifest = json_decode((string) file_get_contents($this->server['inbox'].'/manifest.json'), true);

    if ($mutation === 'extra') {
        unset($manifest['files']['spa/robots.txt']);
    } else {
        $manifest['files']['spa/fantasma.html'] = str_repeat('a', 64);
    }
    file_put_contents($this->server['inbox'].'/manifest.json', json_encode($manifest));

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['state' => 'failed', 'step' => 'extract'])
        ->and(is_dir($this->server['base'].'/releases/2026.11.1'))->toBeFalse()
        ->and(glob($this->server['base'].'/releases/.*tmp*'))->toBe([]);
    expectBaselineIntact($this->server);
})->with(['arquivo a mais no pacote' => ['extra'], 'arquivo faltando no pacote' => ['missing']]);

it('recusa arquivo com SHA-256 diferente do manifest', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1');
    $manifest = json_decode((string) file_get_contents($this->server['inbox'].'/manifest.json'), true);
    $manifest['files']['spa/index.html'] = str_repeat('0', 64);
    file_put_contents($this->server['inbox'].'/manifest.json', json_encode($manifest));

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(statusOf($this->server, '2026.11.1')['message'])->toContain('spa/index.html');
    expectBaselineIntact($this->server);
});

it('recusa manifest com caminho que sai da release (path traversal)', function (string $path) {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1');
    $manifest = json_decode((string) file_get_contents($this->server['inbox'].'/manifest.json'), true);
    $manifest['files'][$path] = str_repeat('a', 64);
    file_put_contents($this->server['inbox'].'/manifest.json', json_encode($manifest));

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(statusOf($this->server, '2026.11.1')['step'])->toBe('manifest');
    expectBaselineIntact($this->server);
})->with(['../fora.php', 'spa/../../fora.php', '/etc/passwd', 'spa\\..\\x', '']);

it('recusa release-id que não é AAAA.MM.N, sem criar nada fora da pasta', function (string $id) {
    installBaseline($this->server);
    $manifest = ['release_id' => $id, 'package' => ['name' => "release-{$id}.tar.gz", 'sha256' => str_repeat('a', 64)], 'files' => ['backend/artisan' => str_repeat('a', 64)]];
    file_put_contents($this->server['inbox'].'/manifest.json', json_encode($manifest));

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)
        ->and(glob($this->server['home'].'/private/pibls/releases/*'))->toBe([$this->server['base'].'/releases/2026.10.1'])
        ->and(file_exists($this->server['home'].'/private/etc'))->toBeFalse();
    expectBaselineIntact($this->server);
})->with(['../../etc', '2026.13.1', '2026.1.1', 'latest', '2026.11.1/../../x']);

it('não ativa de novo a release que já está ativa', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.10.1');

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(statusOf($this->server, '2026.10.1')['step'])->toBe('exists');
    expectBaselineIntact($this->server);
});

it('repete uma release que falhou antes: recomeça do zero com o mesmo id', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1', ['fail' => ['migrate']]);
    expect(finalize($this->server)['exit'])->toBe(1);

    stageRelease($this->server, '2026.11.1'); // o CI corrigiu e reenviou
    $result = finalize($this->server);

    expect($result['exit'])->toBe(0, $result['output'])->and(activeRelease($this->server))->toBe('2026.11.1');
});

// ---------------------------------------------------------------------------------------------------------------
// Rollback: troca o ponteiro e o HTML; não migra
// ---------------------------------------------------------------------------------------------------------------

it('o rollback restaura o ponteiro e o HTML da release anterior, sem rodar migrations', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);
    stageRelease($this->server, '2026.11.2');
    finalize($this->server);
    @unlink($this->server['base'].'/shared/calls.log');
    file_put_contents($this->server['docroot'].'/index.html', '<html>adulterado</html>');
    file_put_contents($this->server['inbox'].'/rollback.json', json_encode(['release_id' => '2026.11.1']));

    $result = finalize($this->server);

    expect($result['exit'])->toBe(0, $result['output'])
        ->and(activeRelease($this->server))->toBe('2026.11.1')
        ->and(file_get_contents($this->server['docroot'].'/index.html'))->toBe('<html>inicio 2026.11.1</html>')
        ->and(file_get_contents($this->server['docroot'].'/quem-somos.html'))->toBe('<html>quem somos 2026.11.1</html>')
        ->and(artisanCalls($this->server))->toBe(['pibls:release:activated 2026.11.1 --rolled-back'])
        ->and(statusOf($this->server, '2026.11.1'))->toMatchArray(['state' => 'active', 'via' => 'rollback', 'previous_release_id' => '2026.11.2'])
        ->and(json_decode((string) file_get_contents($this->server['status'].'/current.json'), true))
        ->toMatchArray(['release_id' => '2026.11.1', 'previous_release_id' => '2026.11.2'])
        ->and(inboxFiles($this->server))->toBe([]);
});

it('o rollback não toca uploads/, data/, .well-known/ nem cgi-bin/', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);
    stageRelease($this->server, '2026.11.2');
    finalize($this->server);
    file_put_contents($this->server['inbox'].'/rollback.json', json_encode(['release_id' => '2026.11.1']));

    finalize($this->server);

    expect(file_get_contents($this->server['docroot'].'/uploads/boletins/2026/ficha.pdf'))->toBe('PDF DO USUARIO')
        ->and(file_get_contents($this->server['docroot'].'/data/settings.json'))->toBe('{"gerado":"pelo backend"}')
        ->and(file_get_contents($this->server['docroot'].'/.well-known/acme-challenge/token'))->toBe('TOKEN-AUTOSSL');
});

it('o rollback para uma release que não existe falha e mantém a atual', function (string $target) {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);
    file_put_contents($this->server['inbox'].'/rollback.json', json_encode(['release_id' => $target]));

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(activeRelease($this->server))->toBe('2026.11.1')->and(inboxFiles($this->server))->toBe([]);
})->with(['2026.01.9', '../x', '']);

it('o rollback sem release_id falha', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);
    file_put_contents($this->server['inbox'].'/rollback.json', '{}');

    expect(finalize($this->server)['exit'])->toBe(1)->and(activeRelease($this->server))->toBe('2026.11.1');
});

// ---------------------------------------------------------------------------------------------------------------
// Concorrência, caixa vazia e uploads incompletos
// ---------------------------------------------------------------------------------------------------------------

it('um lock em uso faz o ativador sair sem efeito algum', function () {
    installBaseline($this->server);
    stageRelease($this->server, '2026.11.1');
    $lock = fopen($this->server['base'].'/deploy/lock/finalize.lock', 'c');
    expect(flock($lock, LOCK_EX | LOCK_NB))->toBeTrue(); // outro ativador "está rodando"

    $result = finalize($this->server);

    expect($result['exit'])->toBe(0)
        ->and(activeRelease($this->server))->toBe('2026.10.1')
        ->and(file_exists($this->server['status'].'/2026.11.1.json'))->toBeFalse()
        ->and(inboxFiles($this->server))->toBe(['manifest.json', 'release-2026.11.1.tar.gz'])
        ->and(artisanCalls($this->server))->toBe([]);

    flock($lock, LOCK_UN);
    fclose($lock);

    // Solto o lock, a próxima execução ativa normalmente
    expect(finalize($this->server)['exit'])->toBe(0)->and(activeRelease($this->server))->toBe('2026.11.1');
});

it('sem nada na caixa de entrada termina sem fazer nada', function () {
    $result = finalize($this->server);

    expect($result)->toBe(['exit' => 0, 'output' => ''])
        ->and(activeRelease($this->server))->toBeNull()
        ->and(glob($this->server['status'].'/*'))->toBe([]);
});

it('um manifest recém-chegado e ainda incompleto espera, em vez de falhar', function () {
    file_put_contents($this->server['inbox'].'/manifest.json', '{"release_id": "2026.11');

    $result = finalize($this->server);

    expect($result['exit'])->toBe(0)->and(inboxFiles($this->server))->toBe(['manifest.json']);
});

it('um manifest ilegível há mais de 2 minutos é falha e é descartado', function () {
    file_put_contents($this->server['inbox'].'/manifest.json', 'lixo');
    touch($this->server['inbox'].'/manifest.json', time() - 600);

    $result = finalize($this->server);

    expect($result['exit'])->toBe(1)->and(inboxFiles($this->server))->toBe([]);
});

it('apaga pacote abandonado (sem manifest há mais de um dia), mas não o recente', function () {
    file_put_contents($this->server['inbox'].'/release-2026.09.1.tar.gz', 'velho');
    touch($this->server['inbox'].'/release-2026.09.1.tar.gz', time() - 2 * 86400);
    file_put_contents($this->server['inbox'].'/release-2026.11.1.tar.gz', 'em upload agora');

    finalize($this->server);

    expect(inboxFiles($this->server))->toBe(['release-2026.11.1.tar.gz']);
});

it('recusa aplicação desconhecida', function () {
    $process = new Process([PHP_BINARY, FINALIZE, 'outra-coisa', "--home={$this->server['home']}"]);
    $process->run();

    expect($process->getExitCode())->toBe(2)->and($process->getErrorOutput())->toContain('Uso:');
});

it('registra o que fez em storage/logs/finalize-AAAA-MM-DD.log, sem dado pessoal', function () {
    stageRelease($this->server, '2026.11.1');
    finalize($this->server);

    $log = (string) file_get_contents($this->server['base'].'/shared/storage/logs/finalize-'.gmdate('Y-m-d').'.log');
    $lines = array_map(fn (string $line) => json_decode($line, true), array_filter(explode("\n", $log)));

    expect($lines)->not->toBeEmpty()
        ->and($lines[0])->toHaveKeys(['timestamp', 'level', 'app', 'release', 'message'])
        ->and(end($lines)['message'])->toContain('2026.11.1');
});
