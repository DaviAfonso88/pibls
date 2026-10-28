<?php

declare(strict_types=1);

use App\Modules\Platform\Models\AuditLog;
use App\Modules\Platform\Snapshots\SnapshotDefinition;
use App\Modules\Platform\Snapshots\SnapshotRegenerator;
use App\Modules\Platform\Snapshots\SnapshotRegistry;
use App\Modules\Platform\Snapshots\SnapshotWriter;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

/*
| DevOps → Ativador, passo 9: depois de trocar o ponteiro, o ativador roda `pibls:release:activated` na release nova.
*/

beforeEach(function () {
    $this->snapshotDir = sys_get_temp_dir().'/pibls-release-'.bin2hex(random_bytes(4));
    config(['pibls.snapshots_path' => $this->snapshotDir]);
    app()->forgetInstance(SnapshotWriter::class);

    $registry = new SnapshotRegistry;
    $registry->register(new class implements SnapshotDefinition
    {
        public function name(): string
        {
            return 'home';
        }

        public function build(): array
        {
            return ['ok' => true];
        }

        public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
        {
            return false;
        }
    });
    app()->instance(SnapshotRegistry::class, $registry);
    app()->forgetInstance(SnapshotRegenerator::class);
});

afterEach(function () {
    File::deleteDirectory($this->snapshotDir);
});

it('registra release.activated na auditoria e regenera os snapshots', function () {
    $exit = Artisan::call('pibls:release:activated', ['release_id' => '2026.11.3']);

    $log = AuditLog::query()->where('action', 'release.activated')->sole();
    expect($exit)->toBe(0)
        ->and($log->resource_type)->toBe('release')
        ->and($log->resource_id)->toBe('2026.11.3')
        ->and($log->actor_user_id)->toBeNull()
        ->and(file_exists("{$this->snapshotDir}/home.json"))->toBeTrue()
        ->and(Artisan::output())->toContain('Snapshot home regenerado.')->toContain('Ativação de 2026.11.3 registrada.');
});

it('registra release.rolled_back quando é um rollback', function () {
    $exit = Artisan::call('pibls:release:activated', ['release_id' => '2026.11.2', '--rolled-back' => true]);

    expect($exit)->toBe(0)
        ->and(AuditLog::query()->where('action', 'release.rolled_back')->where('resource_id', '2026.11.2')->count())->toBe(1)
        ->and(AuditLog::query()->where('action', 'release.activated')->count())->toBe(0);
});

it('sai com erro, sem lançar exceção, quando um snapshot não pode ser regenerado', function () {
    $registry = new SnapshotRegistry;
    $registry->register(new class implements SnapshotDefinition
    {
        public function name(): string
        {
            return 'settings';
        }

        public function build(): array
        {
            throw new RuntimeException('banco indisponível');
        }

        public function hasScheduledChange(CarbonInterface $since, CarbonInterface $until): bool
        {
            return false;
        }
    });
    app()->instance(SnapshotRegistry::class, $registry);
    app()->forgetInstance(SnapshotRegenerator::class);

    $exit = Artisan::call('pibls:release:activated', ['release_id' => '2026.11.3']);

    // A auditoria é gravada mesmo assim; o ativador só registra o aviso e mantém a release ativa
    expect($exit)->toBe(1)
        ->and(Artisan::output())->toContain('Falha ao regenerar o snapshot settings.')
        ->and(AuditLog::query()->where('action', 'release.activated')->count())->toBe(1);
});
