<?php

declare(strict_types=1);

use App\Modules\Platform\DomainEvents\PublicContentChanged;
use App\Modules\Platform\Snapshots\SnapshotDefinition;
use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use App\Modules\Platform\Snapshots\SnapshotRegistry;
use App\Modules\Platform\Snapshots\SnapshotWriter;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event as Events;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/*
| ADR-014 e contracts/snapshots.md: arquivos JSON estáticos gravados de forma atômica, regenerados pelo evento
| PublicContentChanged, pelo agendador e na ativação da release.
*/

/**
 * Definição de teste: devolve o que se pedir e informa se há conteúdo agendado vencendo.
 *
 * @param  array<array-key, mixed>|Closure  $data
 */
function fakeSnapshot(string $name, array|Closure $data = ['ok' => true], bool|Closure $scheduledChange = false): SnapshotDefinition
{
    return new class($name, $data, $scheduledChange) implements SnapshotDefinition
    {
        public int $builds = 0;

        public function __construct(private string $name, private array|Closure $data, private bool|Closure $scheduledChange) {}

        public function name(): string
        {
            return $this->name;
        }

        public function build(): array
        {
            $this->builds++;

            return $this->data instanceof Closure ? ($this->data)() : $this->data;
        }

        public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
        {
            return $this->scheduledChange instanceof Closure ? ($this->scheduledChange)($since, $until) : $this->scheduledChange;
        }
    };
}

/** Troca a pasta de snapshots por uma temporária e devolve o registro novo, já ligado ao container. */
function useSnapshotsIn(string $directory, SnapshotDefinition ...$definitions): SnapshotRegistry
{
    config(['pibls.snapshots_path' => $directory]);
    app()->forgetInstance(SnapshotWriter::class);
    app()->forgetInstance(SnapshotRegenerator::class);

    $registry = new SnapshotRegistry;
    foreach ($definitions as $definition) {
        $registry->register($definition);
    }
    app()->instance(SnapshotRegistry::class, $registry);

    return $registry;
}

function readSnapshot(string $directory, string $name): array
{
    return json_decode((string) file_get_contents("{$directory}/{$name}.json"), true, flags: JSON_THROW_ON_ERROR);
}

beforeEach(function () {
    $this->snapshotDir = sys_get_temp_dir().'/pibls-snapshots-'.bin2hex(random_bytes(4));
});

afterEach(function () {
    File::deleteDirectory($this->snapshotDir);
});

// ---------------------------------------------------------------------------------------------------------------
// SnapshotWriter
// ---------------------------------------------------------------------------------------------------------------

it('grava {data, generated_at} em ISO 8601 UTC, com a permissão que o Apache precisa', function () {
    $writer = new SnapshotWriter($this->snapshotDir);

    $path = $writer->write('settings', ['campaign' => ['title' => 'Estamos Construindo — Você pode ajudar']], new DateTimeImmutable('2026-11-08 10:10:00', new DateTimeZone('-03:00')));

    expect($path)->toBe("{$this->snapshotDir}/settings.json")
        ->and(readSnapshot($this->snapshotDir, 'settings'))->toBe([
            'data' => ['campaign' => ['title' => 'Estamos Construindo — Você pode ajudar']],
            'generated_at' => '2026-11-08T13:10:00Z',
        ])
        ->and(file_get_contents($path))->toContain('Você')->not->toContain('\\u00ea') // UTF-8 de verdade, mais curto
        ->and(substr(sprintf('%o', fileperms($path)), -4))->toBe('0644');
});

it('cria a pasta que não existe e não deixa arquivo temporário para trás', function () {
    $writer = new SnapshotWriter("{$this->snapshotDir}/aninhada");

    $writer->write('home', ['a' => 1]);
    $writer->write('home', ['a' => 2]);

    expect(scandir("{$this->snapshotDir}/aninhada"))->toBe(['.', '..', 'home.json'])
        ->and(readSnapshot("{$this->snapshotDir}/aninhada", 'home')['data'])->toBe(['a' => 2]);
});

it('recusa nome de snapshot que sairia da pasta', function (string $name) {
    expect(fn () => (new SnapshotWriter($this->snapshotDir))->write($name, []))->toThrow(InvalidArgumentException::class);
})->with(['../settings', 'a/b', '', 'Settings', '.oculto', 'a b']);

it('se o conteúdo não vira JSON, o arquivo anterior continua intacto', function () {
    $writer = new SnapshotWriter($this->snapshotDir);
    $writer->write('home', ['versao' => 'boa']);

    expect(fn () => $writer->write('home', ['quebrado' => "\xB1\x31"]))->toThrow(JsonException::class);

    expect(readSnapshot($this->snapshotDir, 'home')['data'])->toBe(['versao' => 'boa'])
        ->and(scandir($this->snapshotDir))->toBe(['.', '..', 'home.json']);
});

it('gravação atômica: um leitor concorrente sempre recebe JSON válido e completo', function () {
    File::ensureDirectoryExists($this->snapshotDir);
    $process = new Process([PHP_BINARY, base_path('tests/Support/snapshot-writer-loop.php'), $this->snapshotDir, '250']);
    $process->start();

    $file = "{$this->snapshotDir}/home.json";
    $reads = 0;
    $invalid = [];
    $lastIteration = 0;

    while ($process->isRunning()) {
        $raw = @file_get_contents($file);
        if ($raw === false) {
            continue; // o filho ainda não gravou a primeira vez
        }

        $reads++;
        $decoded = json_decode($raw, true);
        if (! is_array($decoded) || ! isset($decoded['data']['iteration'], $decoded['generated_at']) || count($decoded['data']['items']) !== 400) {
            $invalid[] = strlen($raw).' bytes';

            continue;
        }

        // A cada leitura o arquivo está igual ou mais novo: nunca volta no tempo
        expect($decoded['data']['iteration'])->toBeGreaterThanOrEqual($lastIteration);
        $lastIteration = $decoded['data']['iteration'];
    }

    expect($process->getExitCode())->toBe(0, $process->getErrorOutput())
        ->and($reads)->toBeGreaterThan(50)
        ->and($invalid)->toBe([])
        ->and($lastIteration)->toBeGreaterThan(1);
});

// ---------------------------------------------------------------------------------------------------------------
// Registro e regenerador
// ---------------------------------------------------------------------------------------------------------------

it('o registro recusa dois snapshots com o mesmo nome e snapshot desconhecido', function () {
    $registry = new SnapshotRegistry;
    $registry->register(fakeSnapshot('home'));

    expect(fn () => $registry->register(fakeSnapshot('home')))->toThrow(InvalidArgumentException::class, 'já está registrado')
        ->and(fn () => $registry->only(['home', 'inexistente']))->toThrow(InvalidArgumentException::class, 'inexistente')
        ->and(array_keys($registry->only(['home'])))->toBe(['home'])
        ->and(array_keys($registry->only(null)))->toBe(['home']);
});

it('regenera todos os snapshots, ou só os pedidos', function () {
    $settings = fakeSnapshot('settings', ['a' => 1]);
    $home = fakeSnapshot('home', ['b' => 2]);
    useSnapshotsIn($this->snapshotDir, $settings, $home);

    $all = app(SnapshotRegenerator::class)->refresh();
    $one = app(SnapshotRegenerator::class)->refresh(['home']);

    expect($all)->toBe(['written' => ['settings', 'home'], 'failed' => []])
        ->and($one)->toBe(['written' => ['home'], 'failed' => []])
        ->and([$settings->builds, $home->builds])->toBe([1, 2])
        ->and(readSnapshot($this->snapshotDir, 'settings')['data'])->toBe(['a' => 1]);
});

it('uma definição que falha não impede as outras, e o erro é registrado sem derrubar a operação', function () {
    Log::spy();
    useSnapshotsIn(
        $this->snapshotDir,
        fakeSnapshot('settings', fn () => throw new RuntimeException('banco caiu')),
        fakeSnapshot('home', ['ok' => true]),
    );

    $result = app(SnapshotRegenerator::class)->refresh();

    expect($result)->toBe(['written' => ['home'], 'failed' => ['settings']])
        ->and(file_exists("{$this->snapshotDir}/settings.json"))->toBeFalse()
        ->and(file_exists("{$this->snapshotDir}/home.json"))->toBeTrue();
    Log::shouldHaveReceived('error')->withArgs(fn (string $message, array $context) => $message === 'snapshots.refresh_failed' && $context['snapshot'] === 'settings')->once();
});

it('regenera em até 1 segundo com consultas reais ao banco', function () {
    $queries = fn (string $table) => fn () => DB::table($table)->limit(100)->get()->map(fn ($row) => (array) $row)->all();
    useSnapshotsIn(
        $this->snapshotDir,
        fakeSnapshot('settings', $queries('site_settings')),
        fakeSnapshot('ministries', $queries('ministries_groups')),
        fakeSnapshot('home', $queries('bulletins')),
    );

    $start = hrtime(true);
    $result = app(SnapshotRegenerator::class)->refresh();
    $elapsedMs = (hrtime(true) - $start) / 1_000_000;

    expect($result['failed'])->toBe([])
        ->and($result['written'])->toHaveCount(3)
        ->and($elapsedMs)->toBeLessThan(1000);
});

// ---------------------------------------------------------------------------------------------------------------
// Evento PublicContentChanged
// ---------------------------------------------------------------------------------------------------------------

it('o evento PublicContentChanged regenera os snapshots na hora, depois do commit', function () {
    $home = fakeSnapshot('home', ['n' => 1]);
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('settings'), $home);

    event(new PublicContentChanged);

    expect(file_exists("{$this->snapshotDir}/settings.json"))->toBeTrue()
        ->and(file_exists("{$this->snapshotDir}/home.json"))->toBeTrue();
});

it('o evento pode pedir só alguns snapshots', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('settings'), fakeSnapshot('home'));

    event(new PublicContentChanged(['home']));

    expect(file_exists("{$this->snapshotDir}/home.json"))->toBeTrue()
        ->and(file_exists("{$this->snapshotDir}/settings.json"))->toBeFalse();
});

it('se a transação que mudou o dado desfaz, o arquivo público não é regenerado', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('home'));

    try {
        DB::transaction(function () {
            event(new PublicContentChanged);
            throw new RuntimeException('a operação falhou');
        });
    } catch (RuntimeException) {
        // esperado
    }

    expect(file_exists("{$this->snapshotDir}/home.json"))->toBeFalse();
});

it('o evento está ligado ao listener de snapshots', function () {
    expect(Events::hasListeners(PublicContentChanged::class))->toBeTrue();
});

// ---------------------------------------------------------------------------------------------------------------
// Regeneração agendada (BR-042)
// ---------------------------------------------------------------------------------------------------------------

it('BR-042 regenera só o snapshot cujo conteúdo agendado passou a valer', function () {
    $now = CarbonImmutable::parse('2026-11-08 10:00:00', 'UTC');
    $home = fakeSnapshot('home', ['n' => 1], fn (CarbonInterface $since, CarbonInterface $until) => $until->equalTo($now) && $since->lessThan($until));
    $settings = fakeSnapshot('settings', ['n' => 2], false);
    useSnapshotsIn($this->snapshotDir, $home, $settings);

    $result = app(SnapshotRegenerator::class)->refreshScheduled($now);

    expect($result)->toBe(['written' => ['home'], 'failed' => []])
        ->and([$home->builds, $settings->builds])->toBe([1, 0])
        ->and(file_exists("{$this->snapshotDir}/settings.json"))->toBeFalse();
});

it('BR-042 olha o intervalo entre a última execução e agora, sem repetir nem perder instantes', function () {
    $windows = [];
    $home = fakeSnapshot('home', ['n' => 1], function (CarbonInterface $since, CarbonInterface $until) use (&$windows) {
        $windows[] = [$since->toDateTimeString(), $until->toDateTimeString()];

        return false;
    });
    useSnapshotsIn($this->snapshotDir, $home);
    $regenerator = app(SnapshotRegenerator::class);

    $regenerator->refreshScheduled(CarbonImmutable::parse('2026-11-08 10:00:00', 'UTC'));
    $regenerator->refreshScheduled(CarbonImmutable::parse('2026-11-08 10:05:00', 'UTC'));
    $regenerator->refreshScheduled(CarbonImmutable::parse('2026-11-08 10:10:00', 'UTC'));

    expect($windows)->toBe([
        ['2026-11-08 09:50:00', '2026-11-08 10:00:00'], // primeira execução: olha 10 min para trás
        ['2026-11-08 10:00:00', '2026-11-08 10:05:00'],
        ['2026-11-08 10:05:00', '2026-11-08 10:10:00'],
    ]);
});

it('BR-042 não grava nada quando nenhum conteúdo agendado venceu', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('home', ['n' => 1], false));

    $result = app(SnapshotRegenerator::class)->refreshScheduled();

    expect($result)->toBe(['written' => [], 'failed' => []])
        ->and(file_exists("{$this->snapshotDir}/home.json"))->toBeFalse();
});

it('BR-042 se a regeneração falha, a próxima execução tenta o mesmo intervalo de novo', function () {
    Log::spy();
    $fail = true;
    $windows = [];
    $home = fakeSnapshot(
        'home',
        function () use (&$fail) {
            if ($fail) {
                throw new RuntimeException('falhou');
            }

            return ['n' => 1];
        },
        function (CarbonInterface $since) use (&$windows) {
            $windows[] = $since->toDateTimeString();

            return true;
        },
    );
    useSnapshotsIn($this->snapshotDir, $home);
    $regenerator = app(SnapshotRegenerator::class);

    $first = $regenerator->refreshScheduled(CarbonImmutable::parse('2026-11-08 10:00:00', 'UTC'));
    $fail = false;
    $second = $regenerator->refreshScheduled(CarbonImmutable::parse('2026-11-08 10:05:00', 'UTC'));

    expect($first['failed'])->toBe(['home'])
        ->and($second)->toBe(['written' => ['home'], 'failed' => []])
        ->and($windows)->toBe(['2026-11-08 09:50:00', '2026-11-08 09:50:00']); // a marca não avançou na falha
});

// ---------------------------------------------------------------------------------------------------------------
// Comandos e agendador
// ---------------------------------------------------------------------------------------------------------------

it('pibls:snapshots:refresh regenera tudo e informa o que fez', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('settings'), fakeSnapshot('home'));

    $exit = Artisan::call('pibls:snapshots:refresh');

    expect($exit)->toBe(0)
        ->and(Artisan::output())->toContain('Snapshot settings regenerado.')->toContain('Snapshot home regenerado.');
});

it('pibls:snapshots:refresh --only regenera só o pedido e recusa nome desconhecido', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('settings'), fakeSnapshot('home'));

    expect(Artisan::call('pibls:snapshots:refresh', ['--only' => ['home']]))->toBe(0)
        ->and(file_exists("{$this->snapshotDir}/settings.json"))->toBeFalse();

    expect(Artisan::call('pibls:snapshots:refresh', ['--only' => ['fantasma']]))->toBe(2)
        ->and(Artisan::output())->toContain('Snapshot desconhecido: fantasma');
});

it('pibls:snapshots:refresh sai com erro quando uma definição falha', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('settings', fn () => throw new RuntimeException('x')));

    expect(Artisan::call('pibls:snapshots:refresh'))->toBe(1)
        ->and(Artisan::output())->toContain('Falha ao regenerar o snapshot settings.');
});

it('pibls:snapshots:refresh avisa quando não há nenhum snapshot registrado', function () {
    useSnapshotsIn($this->snapshotDir);

    expect(Artisan::call('pibls:snapshots:refresh'))->toBe(0)
        ->and(Artisan::output())->toContain('Nenhum snapshot registrado.');
});

it('pibls:snapshots:refresh-scheduled roda o ciclo agendado', function () {
    useSnapshotsIn($this->snapshotDir, fakeSnapshot('home', ['n' => 1], true));

    expect(Artisan::call('pibls:snapshots:refresh-scheduled'))->toBe(0)
        ->and(Artisan::output())->toContain('Snapshot home regenerado (conteúdo agendado passou a valer).');
});

it('o agendador roda pibls:snapshots:refresh-scheduled a cada 5 minutos, sem sobreposição', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn (Event $event) => str_contains($event->command ?? '', 'pibls:snapshots:refresh-scheduled'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('*/5 * * * *')
        ->and($event->withoutOverlapping)->toBeTrue();
});
