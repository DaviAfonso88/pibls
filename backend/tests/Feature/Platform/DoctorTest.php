<?php

declare(strict_types=1);

use App\Modules\Platform\Doctor\CheckResult;
use App\Modules\Platform\Doctor\CheckStatus;
use App\Modules\Platform\Doctor\Doctor;
use App\Modules\Platform\Doctor\SystemProbe;
use Illuminate\Support\Facades\Artisan;

/*
| Infrastructure → `pibls:doctor`: o ativador o chama antes de cada ativação; erro mantém a release anterior ativa.
*/

/**
 * Servidor simulado: parte do ambiente real e troca só o que o teste pede.
 *
 * @param  array<string, mixed>  $overrides
 */
function fakeServer(array $overrides = []): SystemProbe
{
    return new class($overrides) extends SystemProbe
    {
        /** @param array<string, mixed> $overrides */
        public function __construct(private array $overrides) {}

        public function phpVersion(): string
        {
            return $this->overrides['phpVersion'] ?? parent::phpVersion();
        }

        public function extensionLoaded(string $extension): bool
        {
            return ! in_array($extension, $this->overrides['missingExtensions'] ?? [], true) && parent::extensionLoaded($extension);
        }

        public function iniValue(string $key): ?string
        {
            return array_key_exists($key, $this->overrides['ini'] ?? []) ? $this->overrides['ini'][$key] : parent::iniValue($key);
        }

        public function gdSupportsWebp(): bool
        {
            return $this->overrides['webp'] ?? parent::gdSupportsWebp();
        }

        public function opcacheEnabled(): bool
        {
            return $this->overrides['opcache'] ?? parent::opcacheEnabled();
        }

        public function canWriteTo(string $directory): bool
        {
            foreach ($this->overrides['unwritable'] ?? [] as $blocked) {
                if (str_contains($directory, $blocked)) {
                    return false;
                }
            }

            return parent::canWriteTo($directory);
        }

        public function databaseVersion(): string
        {
            $version = $this->overrides['dbVersion'] ?? parent::databaseVersion();
            if ($version instanceof Throwable) {
                throw $version;
            }

            return $version;
        }

        public function freeDiskBytes(string $path): ?int
        {
            return array_key_exists('freeDisk', $this->overrides) ? $this->overrides['freeDisk'] : parent::freeDiskBytes($path);
        }
    };
}

/** @return array<string, CheckResult> indexado pelo nome da checagem */
function runDoctor(array $overrides = []): array
{
    $byName = [];
    foreach ((new Doctor(fakeServer($overrides)))->run() as $result) {
        $byName[$result->name] = $result;
    }

    return $byName;
}

it('no ambiente de testes nenhuma checagem dá erro', function () {
    $results = (new Doctor(new SystemProbe))->run();

    $errors = array_filter($results, fn (CheckResult $r) => $r->status === CheckStatus::Error);
    expect(array_map(fn (CheckResult $r) => "{$r->name}: {$r->message}", $errors))->toBe([])
        ->and(Doctor::overall($results))->not->toBe(CheckStatus::Error);
});

it('confere todas as checagens previstas em Infrastructure', function () {
    $names = array_keys(runDoctor());

    expect($names)->toContain(
        'PHP', 'Extensões do PHP', 'memory_limit', 'upload_max_filesize', 'post_max_size', 'max_execution_time',
        'WebP no GD', 'Escrita em uploads/', 'Escrita em data/ (snapshots)', 'Escrita em storage/',
        'Banco de dados', 'APP_KEY', 'APP_DEBUG', 'PIX_ALERT_RECIPIENTS', 'Espaço em disco', 'OPcache',
    );
});

it('exige PHP 8.4 ou superior', function (string $version, CheckStatus $expected) {
    expect(runDoctor(['phpVersion' => $version])['PHP']->status)->toBe($expected);
})->with([
    ['8.3.12', CheckStatus::Error],
    ['8.4.0', CheckStatus::Ok],
    ['8.4.17', CheckStatus::Ok],
    ['8.5.1', CheckStatus::Ok],
]);

it('acusa as extensões que faltam, pelo nome', function () {
    $result = runDoctor(['missingExtensions' => ['sodium', 'intl']])['Extensões do PHP'];

    expect($result->status)->toBe(CheckStatus::Error)
        ->and($result->message)->toContain('sodium')->toContain('intl')->not->toContain('mbstring');
});

it('confere os limites do PHP contra os mínimos desejados (MultiPHP INI)', function (string $key, ?string $value, CheckStatus $expected) {
    expect(runDoctor(['ini' => [$key => $value]])[$key]->status)->toBe($expected);
})->with([
    'memory_limit 128M' => ['memory_limit', '128M', CheckStatus::Error],
    'memory_limit 256M' => ['memory_limit', '256M', CheckStatus::Ok],
    'memory_limit 1G' => ['memory_limit', '1G', CheckStatus::Ok],
    'memory_limit ilimitado' => ['memory_limit', '-1', CheckStatus::Ok],
    'memory_limit ilegível' => ['memory_limit', null, CheckStatus::Warning],
    'upload 2M' => ['upload_max_filesize', '2M', CheckStatus::Error],
    'upload 12M' => ['upload_max_filesize', '12M', CheckStatus::Ok],
    'upload em KB' => ['upload_max_filesize', '8192K', CheckStatus::Error],
    'post 12M' => ['post_max_size', '12M', CheckStatus::Error],
    'post 13M' => ['post_max_size', '13M', CheckStatus::Ok],
    'tempo 30 s' => ['max_execution_time', '30', CheckStatus::Error],
    'tempo 60 s' => ['max_execution_time', '60', CheckStatus::Ok],
    'tempo ilimitado (CLI)' => ['max_execution_time', '0', CheckStatus::Ok],
]);

it('exige WebP no GD', function (bool $webp, CheckStatus $expected) {
    expect(runDoctor(['webp' => $webp])['WebP no GD']->status)->toBe($expected);
})->with([[false, CheckStatus::Error], [true, CheckStatus::Ok]]);

it('acusa pasta sem permissão de escrita', function (string $name, string $blocked) {
    $result = runDoctor(['unwritable' => [$blocked]])[$name];

    expect($result->status)->toBe(CheckStatus::Error)->and($result->message)->toContain('Sem permissão');
})->with([
    ['Escrita em uploads/', 'uploads'],
    ['Escrita em data/ (snapshots)', 'public/data'],
    ['Escrita em storage/', 'html/storage'],
]);

it('confere a conexão e a versão do banco (MySQL 5.7.8 ou superior)', function (string $version, CheckStatus $expected) {
    expect(runDoctor(['dbVersion' => $version])['Banco de dados']->status)->toBe($expected);
})->with([
    'MySQL 5.6' => ['5.6.51', CheckStatus::Error],
    'MySQL 5.7.7' => ['5.7.7', CheckStatus::Error],
    'MySQL 5.7.8' => ['5.7.8', CheckStatus::Ok],
    'MySQL 5.7.44-log' => ['5.7.44-log', CheckStatus::Ok],
    'MySQL 8.0.35' => ['8.0.35', CheckStatus::Ok],
    'MariaDB só avisa' => ['10.11.6-MariaDB-log', CheckStatus::Warning],
    'versão irreconhecível' => ['abc', CheckStatus::Warning],
]);

it('não vaza host nem usuário quando o banco não responde', function () {
    $result = runDoctor(['dbVersion' => new RuntimeException('SQLSTATE[HY000] [1045] Access denied for user \'pibls_app\'@\'localhost\' (host=segredo.interno)')])['Banco de dados'];

    expect($result->status)->toBe(CheckStatus::Error)
        ->and($result->message)->not->toContain('pibls_app')->not->toContain('segredo.interno')->toContain('DB_*');
});

it('exige APP_KEY', function () {
    config(['app.key' => '']);

    expect(runDoctor()['APP_KEY']->status)->toBe(CheckStatus::Error);
    config(['app.key' => 'base64:'.base64_encode(random_bytes(32))]);
    expect(runDoctor()['APP_KEY']->status)->toBe(CheckStatus::Ok);
});

it('A05: APP_DEBUG ligado só é erro em produção e homologação', function (string $env, bool $debug, CheckStatus $expected) {
    $this->app->detectEnvironment(fn () => $env);
    config(['app.debug' => $debug]);

    expect(runDoctor()['APP_DEBUG']->status)->toBe($expected);
})->with([
    'produção com debug' => ['production', true, CheckStatus::Error],
    'produção sem debug' => ['production', false, CheckStatus::Ok],
    'local com debug' => ['local', true, CheckStatus::Ok],
]);

it('BR-063: PIX_ALERT_RECIPIENTS é obrigatório em produção e só um lembrete fora dela', function (string $env, array $recipients, CheckStatus $expected) {
    $this->app->detectEnvironment(fn () => $env);
    config(['pibls.pix_alert_recipients' => $recipients]);

    expect(runDoctor()['PIX_ALERT_RECIPIENTS']->status)->toBe($expected);
})->with([
    'produção sem destinatário' => ['production', [], CheckStatus::Error],
    'produção com endereço inválido' => ['production', ['tesouraria'], CheckStatus::Error],
    'produção configurado' => ['production', ['tesouraria@pibls.com', 'pastor@pibls.com'], CheckStatus::Ok],
    'local sem destinatário' => ['local', [], CheckStatus::Warning],
    'local configurado' => ['local', ['tesouraria@pibls.test'], CheckStatus::Ok],
]);

it('mede o espaço em disco: erro abaixo de 100 MB, aviso abaixo de 500 MB', function (?int $bytes, CheckStatus $expected) {
    expect(runDoctor(['freeDisk' => $bytes])['Espaço em disco']->status)->toBe($expected);
})->with([
    'sem medida' => [null, CheckStatus::Warning],
    '50 MB' => [50 * 1024 * 1024, CheckStatus::Error],
    '300 MB' => [300 * 1024 * 1024, CheckStatus::Warning],
    '2 GB' => [2 * 1024 * 1024 * 1024, CheckStatus::Ok],
]);

it('informa o OPcache sem tratá-lo como problema', function (bool $enabled) {
    $result = runDoctor(['opcache' => $enabled])['OPcache'];

    expect($result->status)->toBe(CheckStatus::Ok)->and($result->message)->toContain('ADR-005');
})->with([[true], [false]]);

it('o resultado geral é o pior dos resultados', function () {
    $ok = CheckResult::ok('a', '');
    $warning = CheckResult::warning('b', '');
    $error = CheckResult::error('c', '');

    expect(Doctor::overall([$ok]))->toBe(CheckStatus::Ok)
        ->and(Doctor::overall([$ok, $warning]))->toBe(CheckStatus::Warning)
        ->and(Doctor::overall([$ok, $warning, $error]))->toBe(CheckStatus::Error)
        ->and(Doctor::overall([]))->toBe(CheckStatus::Ok);
});

it('converte tamanhos do php.ini em bytes', function (string $value, int $bytes) {
    expect(Doctor::bytes($value))->toBe($bytes);
})->with([
    ['256M', 268435456], ['12m', 12582912], ['1G', 1073741824], ['512K', 524288], ['1048576', 1048576],
    ['-1', PHP_INT_MAX], [' 8M ', 8388608],
]);

it('pibls:doctor sai com 0 e imprime o relatório quando não há erro', function () {
    $exit = Artisan::call('pibls:doctor');
    $output = Artisan::output();

    expect($exit)->toBe(0)
        ->and($output)->toContain('✓ PHP:')->toContain('Escrita em uploads/')
        ->and($output)->toMatch('/Tudo certo\.|Há avisos/');
});

it('pibls:doctor --json imprime o relatório para o ativador', function () {
    $exit = Artisan::call('pibls:doctor', ['--json' => true]);
    $report = json_decode(trim(Artisan::output()), true, flags: JSON_THROW_ON_ERROR);

    expect($exit)->toBe(0)
        ->and($report['status'])->toBeIn(['ok', 'warning'])
        ->and($report['checks'])->not->toBeEmpty()
        ->and($report['checks'][0])->toHaveKeys(['name', 'status', 'message']);
});

it('pibls:doctor sai com 1 quando há erro', function () {
    $this->app->bind(SystemProbe::class, fn () => fakeServer(['phpVersion' => '8.2.0', 'missingExtensions' => ['gd']]));

    $exit = Artisan::call('pibls:doctor');

    expect($exit)->toBe(1)
        ->and(Artisan::output())->toContain('✗ PHP:')->toContain('✗ Extensões do PHP:')->toContain('a release não deve ser ativada');
});

it('pibls:doctor --json também sai com 1 quando há erro', function () {
    $this->app->bind(SystemProbe::class, fn () => fakeServer(['webp' => false]));

    $exit = Artisan::call('pibls:doctor', ['--json' => true]);
    $report = json_decode(trim(Artisan::output()), true, flags: JSON_THROW_ON_ERROR);

    expect($exit)->toBe(1)->and($report['status'])->toBe('error');
});
