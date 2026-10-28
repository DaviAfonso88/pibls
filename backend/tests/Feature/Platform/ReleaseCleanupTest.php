<?php

declare(strict_types=1);

use App\Modules\Platform\Releases\ReleaseCleaner;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

/*
|--------------------------------------------------------------------------
| Limpeza semanal das releases (architecture.md → Tarefas do agendador)
|--------------------------------------------------------------------------
| Layout do ativador: <base>/current.php, <base>/releases/<id>/{backend,spa}, <base>/deploy/status/current.json e o docroot
| com assets/ cumulativo. Mantém as 5 últimas e os assets delas; nunca a ativa nem a anterior.
*/

/** Monta um servidor de mentira com as releases pedidas; cada `spa/assets/` tem os arquivos da release. */
function releaseServer(array $releases, string $active, ?string $previous = null): array
{
    $base = sys_get_temp_dir().'/pibls-rel-'.bin2hex(random_bytes(4));
    $docroot = $base.'/public_html';
    File::ensureDirectoryExists($docroot.'/assets');

    foreach ($releases as $id) {
        File::ensureDirectoryExists("{$base}/releases/{$id}/backend");
        File::ensureDirectoryExists("{$base}/releases/{$id}/spa/assets");
        file_put_contents("{$base}/releases/{$id}/backend/artisan", '<?php');
        file_put_contents("{$base}/releases/{$id}/spa/assets/app-{$id}.js", $id);
        file_put_contents("{$base}/releases/{$id}/spa/assets/shared.css", 'css');
        file_put_contents("{$docroot}/assets/app-{$id}.js", $id);
    }
    file_put_contents("{$docroot}/assets/shared.css", 'css');
    file_put_contents("{$docroot}/assets/orfao-de-outro-build.js", 'x');
    file_put_contents("{$base}/current.php", "<?php return 'releases/{$active}';\n");
    File::ensureDirectoryExists("{$base}/deploy/status");
    file_put_contents("{$base}/deploy/status/current.json", json_encode(['release_id' => $active, 'previous_release_id' => $previous]));

    return [$base, $docroot];
}

afterEach(function () {
    foreach ($this->servers ?? [] as $base) {
        File::deleteDirectory($base);
    }
});

it('mantém as 5 últimas releases e apaga as mais antigas, na ordem de versão e não de texto', function () {
    [$base, $docroot] = releaseServer(['2026.11.8', '2026.11.9', '2026.11.10', '2026.11.11', '2026.12.1', '2026.12.2', '2026.12.3'], '2026.12.3', '2026.12.2');
    $this->servers[] = $base;

    $result = (new ReleaseCleaner)->clean($base, $docroot);

    expect($result['kept'])->toBe(['2026.11.10', '2026.11.11', '2026.12.1', '2026.12.2', '2026.12.3'])
        ->and($result['removed'])->toBe(['2026.11.8', '2026.11.9']);
    expect(is_dir("{$base}/releases/2026.11.9"))->toBeFalse()
        ->and(is_dir("{$base}/releases/2026.11.10"))->toBeTrue();
});

it('nunca apaga a release ativa nem a anterior, mesmo velhas (rollback e ponteiro)', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.02.1', '2026.03.1', '2026.04.1', '2026.05.1', '2026.06.1'], '2026.01.2', '2026.01.1');
    $this->servers[] = $base;

    $result = (new ReleaseCleaner)->clean($base, $docroot);

    expect($result['kept'])->toContain('2026.01.1', '2026.01.2')
        ->and(is_dir("{$base}/releases/2026.01.2"))->toBeTrue()
        ->and(is_dir("{$base}/releases/2026.01.1"))->toBeTrue();
});

it('com 5 releases ou menos não apaga nada', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.01.3'], '2026.01.3');
    $this->servers[] = $base;

    expect((new ReleaseCleaner)->clean($base, $docroot)['removed'])->toBe([])
        ->and(is_dir("{$base}/releases/2026.01.1"))->toBeTrue();
});

it('apaga do docroot os assets que nenhuma release mantida usa, e guarda os compartilhados', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.01.3', '2026.01.4', '2026.01.5', '2026.01.6'], '2026.01.6');
    $this->servers[] = $base;

    $result = (new ReleaseCleaner)->clean($base, $docroot);

    // 2026.01.1 saiu: o app-2026.01.1.js dela e o arquivo órfão não são de nenhuma release mantida
    expect($result['assets_removed'])->toBe(2)
        ->and(file_exists("{$docroot}/assets/app-2026.01.1.js"))->toBeFalse()
        ->and(file_exists("{$docroot}/assets/orfao-de-outro-build.js"))->toBeFalse()
        ->and(file_exists("{$docroot}/assets/app-2026.01.2.js"))->toBeTrue()
        ->and(file_exists("{$docroot}/assets/app-2026.01.6.js"))->toBeTrue()
        ->and(file_exists("{$docroot}/assets/shared.css"))->toBeTrue();
});

it('não mexe nos assets se a spa da release ativa não tem assets (evita esvaziar o site)', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.01.3', '2026.01.4', '2026.01.5', '2026.01.6'], '2026.01.6');
    $this->servers[] = $base;
    File::deleteDirectory("{$base}/releases/2026.01.6/spa/assets");

    $result = (new ReleaseCleaner)->clean($base, $docroot);

    expect($result['assets_removed'])->toBe(0)
        ->and(file_exists("{$docroot}/assets/app-2026.01.6.js"))->toBeTrue()
        ->and(file_exists("{$docroot}/assets/orfao-de-outro-build.js"))->toBeTrue();
});

it('sem ponteiro válido não apaga nada', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.01.3', '2026.01.4', '2026.01.5', '2026.01.6'], '2026.01.6');
    $this->servers[] = $base;
    file_put_contents("{$base}/current.php", "<?php return 'releases/../../etc';\n");

    expect(fn () => (new ReleaseCleaner)->clean($base, $docroot))->toThrow(RuntimeException::class, 'Sem release ativa');
    expect(is_dir("{$base}/releases/2026.01.1"))->toBeTrue();
});

it('ignora pastas que não são ids de release', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.01.3', '2026.01.4', '2026.01.5', '2026.01.6'], '2026.01.6');
    $this->servers[] = $base;
    File::ensureDirectoryExists("{$base}/releases/backup-manual");
    file_put_contents("{$base}/releases/backup-manual/importante.txt", 'não toque');

    (new ReleaseCleaner)->clean($base, $docroot);

    expect(file_exists("{$base}/releases/backup-manual/importante.txt"))->toBeTrue();
});

it('o comando pibls:releases:cleanup fora do servidor sai sem fazer nada', function () {
    unset($_SERVER['PIBLS_SHARED_PATH']);
    putenv('PIBLS_SHARED_PATH');

    expect(Artisan::call('pibls:releases:cleanup'))->toBe(0)
        ->and(Artisan::output())->toContain('Fora do servidor');
});

it('o comando limpa a partir de PIBLS_SHARED_PATH e do SNAPSHOTS_PATH (docroot/data)', function () {
    [$base, $docroot] = releaseServer(['2026.01.1', '2026.01.2', '2026.01.3', '2026.01.4', '2026.01.5', '2026.01.6'], '2026.01.6');
    $this->servers[] = $base;
    $_SERVER['PIBLS_SHARED_PATH'] = $base.'/shared';
    config(['pibls.snapshots_path' => $docroot.'/data']);

    $exit = Artisan::call('pibls:releases:cleanup');
    unset($_SERVER['PIBLS_SHARED_PATH']);

    expect($exit)->toBe(0)
        ->and(Artisan::output())->toContain('Removidas: 2026.01.1')
        ->and(is_dir("{$base}/releases/2026.01.1"))->toBeFalse();
});
