<?php

declare(strict_types=1);

use Symfony\Component\Process\Process;

require_once __DIR__.'/helpers.php';

/*
| Modelos de servidor (deploy/templates/*) e .htaccess (deploy/htaccess/*): T017 e T018.
| O roteamento do .htaccess foi conferido num Apache de verdade; aqui ficam as garantias que o ativador e o setup
| da hospedagem exigem do arquivo.
*/

const DEPLOY = __DIR__.'/..';

/** @return array{exit: int, stdout: string, stderr: string} */
function php(array $arguments): array
{
    $process = new Process([PHP_BINARY, ...$arguments]);
    $process->run();

    return ['exit' => (int) $process->getExitCode(), 'stdout' => $process->getOutput(), 'stderr' => $process->getErrorOutput()];
}

afterEach(function () {
    if (isset($this->root)) {
        removeTree($this->root);
    }
});

// ---------------------------------------------------------------------------------------------------------------
// artisan.php: o wrapper do cron
// ---------------------------------------------------------------------------------------------------------------

function installArtisanWrapper(string $root, string $pointer = "<?php return 'releases/2026.11.1';\n"): void
{
    put("{$root}/private/bin/artisan.php", (string) file_get_contents(DEPLOY.'/templates/artisan.php'));
    put("{$root}/private/pibls/current.php", $pointer);
    put("{$root}/private/pibls/releases/2026.11.1/backend/artisan", <<<'PHP'
<?php
echo json_encode(['cwd' => getcwd(), 'shared' => getenv('PIBLS_SHARED_PATH'), 'serverShared' => $_SERVER['PIBLS_SHARED_PATH'] ?? null, 'argv' => $_SERVER['argv']]);
PHP);
}

it('o wrapper roda o artisan da release ativa, com o .env e o storage compartilhados', function () {
    $this->root = scratchDir('pibls-templates');
    installArtisanWrapper($this->root);

    $result = php(["{$this->root}/private/bin/artisan.php", 'pibls', 'schedule:run', '--verbose']);

    $report = json_decode($result['stdout'], true, flags: JSON_THROW_ON_ERROR);
    expect($result['exit'])->toBe(0, $result['stderr'])
        ->and(realpath($report['cwd']))->toBe(realpath("{$this->root}/private/pibls/releases/2026.11.1/backend"))
        ->and($report['shared'])->toBe("{$this->root}/private/pibls/shared")
        ->and($report['serverShared'])->toBe("{$this->root}/private/pibls/shared")
        ->and($report['argv'])->toBe(['artisan', 'schedule:run', '--verbose']);
});

it('o wrapper recusa aplicação desconhecida ou chamada sem comando', function (array $arguments) {
    $this->root = scratchDir('pibls-templates');
    installArtisanWrapper($this->root);

    $result = php(["{$this->root}/private/bin/artisan.php", ...$arguments]);

    expect($result['exit'])->toBe(2)->and($result['stderr'])->toContain('Uso:');
})->with([[['outra', 'schedule:run']], [['pibls']], [[]]]);

it('o wrapper não roda nada sem release ativa ou com ponteiro adulterado', function (?string $pointer) {
    $this->root = scratchDir('pibls-templates');
    installArtisanWrapper($this->root, $pointer ?? '');
    if ($pointer === null) {
        unlink("{$this->root}/private/pibls/current.php");
    }

    $result = php(["{$this->root}/private/bin/artisan.php", 'pibls', 'schedule:run']);

    expect($result['exit'])->toBe(1)->and($result['stdout'])->toBe('')->and($result['stderr'])->toContain('Nenhuma release ativa');
})->with([
    'sem ponteiro' => [null],
    'ponteiro vazio' => ["<?php return '';\n"],
    'caminho que sai da pasta' => ["<?php return 'releases/../../../etc';\n"],
    'id fora do padrão' => ["<?php return 'releases/latest';\n"],
]);

// ---------------------------------------------------------------------------------------------------------------
// index.php: o front controller
// ---------------------------------------------------------------------------------------------------------------

function installFrontController(string $root, ?string $pointer): void
{
    put("{$root}/public_html/index.php", (string) file_get_contents(DEPLOY.'/templates/index.php'));
    if ($pointer !== null) {
        put("{$root}/private/pibls/current.php", $pointer);
    }

    // Laravel de mentira: só o que o front controller toca
    $backend = "{$root}/private/pibls/releases/2026.11.1/backend";
    put("{$backend}/vendor/autoload.php", <<<'PHP'
<?php
namespace Illuminate\Http { class Request { public static function capture(): self { return new self; } } }
PHP);
    put("{$backend}/bootstrap/app.php", <<<'PHP'
<?php
return new class {
    public function usePublicPath(string $path): void { $this->public = $path; }
    public function handleRequest($request): void {
        echo json_encode(['public' => $this->public, 'shared' => $_SERVER['PIBLS_SHARED_PATH'], 'request' => get_class($request)]);
    }
    private string $public = '';
};
PHP);
}

it('o front controller carrega o Laravel da release ativa e aponta o public_path para o docroot', function () {
    $this->root = scratchDir('pibls-templates');
    installFrontController($this->root, "<?php return 'releases/2026.11.1';\n");

    $result = php(["{$this->root}/public_html/index.php"]);

    $report = json_decode($result['stdout'], true, flags: JSON_THROW_ON_ERROR);
    expect($result['exit'])->toBe(0, $result['stderr'])
        ->and(realpath($report['public']))->toBe(realpath("{$this->root}/public_html"))
        ->and($report['shared'])->toEndWith('/private/pibls/shared')
        ->and($report['request'])->toBe('Illuminate\Http\Request');
});

it('o front controller responde 503 sem expor caminho quando não há release ou o ponteiro está adulterado', function (?string $pointer) {
    $this->root = scratchDir('pibls-templates');
    installFrontController($this->root, $pointer);

    $result = php(["{$this->root}/public_html/index.php"]);

    expect($result['stdout'])->toContain('manutenção')->not->toContain($this->root)->not->toContain('releases')
        ->and($result['stdout'])->not->toContain('"public"');
})->with([
    'sem ponteiro' => [null],
    'caminho que sai da pasta' => ["<?php return 'releases/../../../etc/passwd';\n"],
    'id fora do padrão' => ["<?php return 'qualquer-coisa';\n"],
    'não é texto' => ["<?php return ['releases/2026.11.1'];\n"],
]);

// ---------------------------------------------------------------------------------------------------------------
// env.example e cron.txt
// ---------------------------------------------------------------------------------------------------------------

/** @return list<string> as variáveis de ambiente que um arquivo de configuração lê */
function envKeysRead(string $configFile): array
{
    preg_match_all("/env\\(\\s*'([A-Z0-9_]+)'/", (string) file_get_contents($configFile), $matches);

    return array_values(array_unique($matches[1]));
}

it('o env.example do servidor lista todas as variáveis que a configuração do projeto lê', function () {
    $example = (string) file_get_contents(DEPLOY.'/templates/env.example');
    $declared = [];
    foreach (explode("\n", $example) as $line) {
        if (preg_match('/^#?\s*([A-Z][A-Z0-9_]*)=/', $line, $match) === 1) {
            $declared[] = $match[1];
        }
    }

    $read = [
        ...envKeysRead(getcwd().'/config/pibls.php'),
        ...envKeysRead(getcwd().'/config/features.php'),
        // O que a configuração própria do projeto exige em produção, além do padrão do Laravel
        'APP_KEY', 'APP_URL', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD', 'DB_MIGRATOR_USERNAME', 'DB_MIGRATOR_PASSWORD',
        'MAIL_HOST', 'MAIL_FROM_ADDRESS', 'UPLOADS_PATH', 'SNAPSHOTS_PATH', 'SENTRY_LARAVEL_DSN', 'API_DOCS_ENABLED',
        'FEATURE_EVENTS', 'PRIVACY_POLICY_VERSION', 'PIX_ALERT_RECIPIENTS',
    ];

    // TEST_USERS_PASSWORD é só de local e CI; APP_RELEASE e SNAPSHOTS/UPLOADS têm padrão no código ou vêm do pacote
    $mustBeDocumented = array_diff(array_unique($read), ['TEST_USERS_PASSWORD', 'APP_RELEASE']);

    expect(array_values(array_diff($mustBeDocumented, $declared)))->toBe([]);
});

it('o env.example não leva nenhum valor secreto nem endereço real', function () {
    $example = (string) file_get_contents(DEPLOY.'/templates/env.example');

    foreach (['APP_KEY', 'DB_PASSWORD', 'DB_MIGRATOR_PASSWORD', 'MAIL_PASSWORD', 'SENTRY_LARAVEL_DSN', 'HEALTHCHECKS_PING_URL', 'FINALIZE_PING_URL', 'PIX_ALERT_RECIPIENTS', 'MAIL_ALLOWLIST'] as $secret) {
        expect($example)->toMatch("/^{$secret}=\\s*$/m");
    }

    expect($example)->toContain('APP_DEBUG=false')->toContain('APP_ENV=production')->toContain('FEATURE_EVENTS=false')
        ->toContain('API_DOCS_ENABLED=false')->toContain('SESSION_LIFETIME=60')->toContain('RETENTION_ORACAO_DAYS=60');
});

it('o cron.txt tem as quatro tarefas de 5 minutos: ativador e agendador, produção e homologação', function () {
    $cron = (string) file_get_contents(DEPLOY.'/templates/cron.txt');
    $jobs = array_values(array_filter(explode("\n", $cron), fn (string $line) => str_starts_with($line, '*/5 * * * *')));

    expect($jobs)->toHaveCount(4)
        ->and(implode("\n", $jobs))
        ->toContain('private/bin/finalize.php pibls >')
        ->toContain('private/bin/finalize.php pibls-homolog >')
        ->toContain('private/bin/artisan.php pibls schedule:run >')
        ->toContain('private/bin/artisan.php pibls-homolog schedule:run >');
});

// ---------------------------------------------------------------------------------------------------------------
// .htaccess
// ---------------------------------------------------------------------------------------------------------------

it('o .htaccess do docroot tem os marcadores que o ativador usa para mesclar', function () {
    $htaccess = (string) file_get_contents(DEPLOY.'/htaccess/public_html.htaccess');

    expect(str_starts_with($htaccess, '# BEGIN pibls'))->toBeTrue()
        ->and(str_ends_with(trim($htaccess), '# END pibls'))->toBeTrue()
        ->and(substr_count($htaccess, '# BEGIN pibls'))->toBe(1)
        ->and(substr_count($htaccess, '# END pibls'))->toBe(1);
});

it('o .htaccess segue a ordem de resolução do contrato web-routes.md', function () {
    $htaccess = (string) file_get_contents(DEPLOY.'/htaccess/public_html.htaccess');

    $positions = [
        'https' => strpos($htaccess, 'RewriteCond %{HTTPS} !=on'),
        'negados' => strpos($htaccess, 'composer\.(json|lock)'),
        'arquivo existente' => strpos($htaccess, 'RewriteCond %{REQUEST_FILENAME} -f'),
        'pré-renderizada' => strpos($htaccess, '$1.html -f'),
        'laravel' => strpos($htaccess, 'RewriteRule ^(api|sanctum)/ index.php'),
        'fallback' => strpos($htaccess, 'RewriteRule ^ __spa-fallback.html'),
        'cabeçalhos' => strpos($htaccess, 'Strict-Transport-Security'),
    ];

    expect(in_array(false, $positions, true))->toBeFalse()
        ->and(array_values($positions))->toBe(array_values(array_unique($positions)))
        ->and($positions['https'])->toBeLessThan($positions['negados'])
        ->and($positions['negados'])->toBeLessThan($positions['arquivo existente'])
        ->and($positions['arquivo existente'])->toBeLessThan($positions['pré-renderizada'])
        ->and($positions['pré-renderizada'])->toBeLessThan($positions['laravel'])
        ->and($positions['laravel'])->toBeLessThan($positions['fallback'])
        ->and($positions['fallback'])->toBeLessThan($positions['cabeçalhos']);
});

it('o .htaccess manda ao Laravel só o que é dele e declara os cabeçalhos de segurança do contrato', function () {
    $htaccess = (string) file_get_contents(DEPLOY.'/htaccess/public_html.htaccess');

    foreach ([
        'RewriteRule ^(api|sanctum)/ index.php', 'RewriteRule ^eventos/[a-z0-9-]+/?$ index.php',
        'RewriteRule ^palavra-viva/[a-z0-9-]+/?$ index.php', 'RewriteRule ^sitemap\.xml$ index.php',
        'DirectoryIndex index.html', 'Options -Indexes',
        'Header always set Strict-Transport-Security "max-age=31536000"',
        'Header always set X-Content-Type-Options "nosniff"',
        'Header always set Referrer-Policy "strict-origin-when-cross-origin"',
        'Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=()"',
        'Header always set X-Frame-Options "DENY"',
        'public, max-age=31536000, immutable', 'public, max-age=2592000',
    ] as $expected) {
        expect($htaccess)->toContain($expected);
    }

    expect($htaccess)->toContain("default-src 'self'; script-src 'self' 'unsafe-inline' https://gc.zgo.at; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://i.ytimg.com; frame-src https://www.youtube-nocookie.com https://www.google.com; connect-src 'self' https://*.sentry.io https://*.goatcounter.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
});

it('o .htaccess de uploads/ nega execução', function () {
    $htaccess = (string) file_get_contents(DEPLOY.'/htaccess/uploads.htaccess');

    expect($htaccess)->toContain('Options -Indexes -ExecCGI')
        ->toContain('RemoveHandler .php .phtml .phar')
        ->toContain('<FilesMatch "\.(php\d?|phtml|phar|pl|py|cgi|sh)$">')
        ->toContain('Require all denied')
        ->toContain('Header set X-Content-Type-Options "nosniff"');
});
