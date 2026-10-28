<?php

declare(strict_types=1);

use App\Modules\Platform\Backup\BackupCipher;
use App\Modules\Platform\Backup\OffsiteBackup;
use App\Modules\Platform\Monitoring\Healthchecks;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

/*
|--------------------------------------------------------------------------
| Backup (architecture.md → Backup e Recovery, ADR-011, I-08, I-09)
|--------------------------------------------------------------------------
| Dump horário cifrado com a chave pública (a privada nunca está no servidor), retenção local de 48 h, cópia diária ao B2
| (com a mensal no dia 1 e os uploads novos) e heartbeat no Healthchecks, com `/fail` quando algo dá errado.
*/

/** @return array{public: string, secret: string} chaves em base64, como o `pibls:backup:keygen` as imprime */
function backupKeys(): array
{
    $pair = sodium_crypto_box_keypair();

    return [
        'public' => base64_encode(sodium_crypto_box_publickey($pair)),
        'secret' => base64_encode(sodium_crypto_box_secretkey($pair)),
    ];
}

/** Grava um "backup" já pronto na pasta local, com a data de modificação pedida. */
function localBackup(string $dir, string $name, string $content, ?Carbon $modifiedAt = null): string
{
    File::ensureDirectoryExists($dir);
    $path = $dir.'/'.$name;
    file_put_contents($path, $content);
    touch($path, ($modifiedAt ?? now())->getTimestamp());

    return $path;
}

beforeEach(function () {
    $this->backupDir = sys_get_temp_dir().'/pibls-backups-'.bin2hex(random_bytes(4));
    $this->keys = backupKeys();
    config([
        'pibls.backup.enabled' => true,
        'pibls.backup.path' => $this->backupDir,
        'pibls.backup.public_key' => $this->keys['public'],
        'pibls.backup.local_hours' => 48,
        'pibls.backup.offsite_disk' => 'b2',
        'pibls.backup.offsite_backoff' => [0, 0, 0],
        'pibls.healthchecks.backup_db' => 'https://hc-ping.com/db-check',
        'pibls.healthchecks.backup_offsite' => 'https://hc-ping.com/offsite-check',
    ]);
    Http::fake(['hc-ping.com/*' => Http::response('OK')]);
});

afterEach(function () {
    File::deleteDirectory($this->backupDir);
    Carbon::setTestNow();
});

/** @return list<string> URLs pingadas no Healthchecks, na ordem */
function pings(): array
{
    return Http::recorded()
        ->map(fn (array $pair) => $pair[0]->url())
        ->filter(fn (string $url) => str_contains($url, 'hc-ping.com'))
        ->values()
        ->all();
}

describe('cifragem (ADR-011)', function () {
    it('cifra com a chave pública e só abre com a privada', function () {
        $plain = $this->backupDir.'/plain.sql.gz';
        File::ensureDirectoryExists($this->backupDir);
        // Maior que um bloco (64 KB), para passar por vários blocos do secretstream
        file_put_contents($plain, random_bytes(200_000).'CREATE TABLE segredo');

        BackupCipher::encryptFile($plain, $this->backupDir.'/plain.enc', $this->keys['public']);
        BackupCipher::decryptFile($this->backupDir.'/plain.enc', $this->backupDir.'/plain.out', $this->keys['secret']);

        expect(file_get_contents($this->backupDir.'/plain.enc'))->not->toContain('CREATE TABLE segredo')
            ->and(file_get_contents($this->backupDir.'/plain.out'))->toBe(file_get_contents($plain));
    });

    it('não abre com outra chave privada', function () {
        File::ensureDirectoryExists($this->backupDir);
        file_put_contents($this->backupDir.'/a', 'conteúdo');
        BackupCipher::encryptFile($this->backupDir.'/a', $this->backupDir.'/a.enc', $this->keys['public']);

        expect(fn () => BackupCipher::decryptFile($this->backupDir.'/a.enc', $this->backupDir.'/a.out', backupKeys()['secret']))
            ->toThrow(RuntimeException::class);
        expect(file_exists($this->backupDir.'/a.out'))->toBeFalse();
    });

    it('recusa um arquivo adulterado', function () {
        File::ensureDirectoryExists($this->backupDir);
        file_put_contents($this->backupDir.'/a', str_repeat('dado ', 40_000));
        BackupCipher::encryptFile($this->backupDir.'/a', $this->backupDir.'/a.enc', $this->keys['public']);

        $bytes = (string) file_get_contents($this->backupDir.'/a.enc');
        $bytes[strlen($bytes) - 40] = $bytes[strlen($bytes) - 40] === 'x' ? 'y' : 'x';
        file_put_contents($this->backupDir.'/a.enc', $bytes);

        expect(fn () => BackupCipher::decryptFile($this->backupDir.'/a.enc', $this->backupDir.'/a.out', $this->keys['secret']))
            ->toThrow(RuntimeException::class);
    });

    it('recusa uma chave pública inválida', function () {
        File::ensureDirectoryExists($this->backupDir);
        file_put_contents($this->backupDir.'/a', 'x');

        expect(fn () => BackupCipher::encryptFile($this->backupDir.'/a', $this->backupDir.'/a.enc', 'nao-e-uma-chave'))
            ->toThrow(InvalidArgumentException::class);
    });

    it('o pibls:backup:keygen imprime um par que funciona', function () {
        Artisan::call('pibls:backup:keygen');
        $output = Artisan::output();

        preg_match('/BACKUP_PUBLIC_KEY=(\S+)/', $output, $public);
        preg_match('/BACKUP_PRIVATE_KEY=(\S+)/', $output, $secret);
        File::ensureDirectoryExists($this->backupDir);
        file_put_contents($this->backupDir.'/a', 'ok');

        BackupCipher::encryptFile($this->backupDir.'/a', $this->backupDir.'/a.enc', $public[1]);
        BackupCipher::decryptFile($this->backupDir.'/a.enc', $this->backupDir.'/a.out', $secret[1]);

        expect(file_get_contents($this->backupDir.'/a.out'))->toBe('ok');
    });
});

describe('pibls:backup:db', function () {
    it('grava o dump comprimido e cifrado, que só a chave privada abre', function () {
        $exit = Artisan::call('pibls:backup:db');

        $files = glob($this->backupDir.'/db-*.sql.gz.enc') ?: [];
        expect($exit)->toBe(0)->and($files)->toHaveCount(1);

        // Nada em texto claro na pasta de backups: só o arquivo cifrado, nem um temporário oculto
        expect(array_values(array_diff(scandir($this->backupDir) ?: [], ['.', '..'])))->toBe([basename($files[0])]);
        expect(file_get_contents($files[0]))->not->toContain('CREATE TABLE');

        BackupCipher::decryptFile($files[0], $this->backupDir.'/restored.sql.gz', $this->keys['secret']);
        $sql = (string) gzdecode((string) file_get_contents($this->backupDir.'/restored.sql.gz'));
        expect($sql)->toContain('CREATE TABLE `users`')
            ->and($sql)->toContain('CREATE TABLE `leads_messages`')
            ->and($sql)->toContain('permissions');

        // Cache e sessões: a estrutura vai (o restore numa conta nova precisa dela), os dados não
        expect($sql)->toContain('CREATE TABLE `sessions`')->toContain('CREATE TABLE `cache`');
    });

    it('apaga só os backups com mais de 48 h e nunca outros arquivos da pasta', function () {
        Carbon::setTestNow('2026-03-10 12:00:00');
        localBackup($this->backupDir, 'db-20260308-100000.sql.gz.enc', 'velho', now()->subHours(49));
        localBackup($this->backupDir, 'db-20260308-130000.sql.gz.enc', 'quase', now()->subHours(47));
        localBackup($this->backupDir, 'anotacao.txt', 'não é backup', now()->subDays(30));

        Artisan::call('pibls:backup:db');

        expect(file_exists($this->backupDir.'/db-20260308-100000.sql.gz.enc'))->toBeFalse()
            ->and(file_exists($this->backupDir.'/db-20260308-130000.sql.gz.enc'))->toBeTrue()
            ->and(file_exists($this->backupDir.'/anotacao.txt'))->toBeTrue()
            ->and(glob($this->backupDir.'/db-2026031*.sql.gz.enc'))->toHaveCount(1);
    });

    it('avisa o Healthchecks no sucesso e com /fail na falha', function () {
        Artisan::call('pibls:backup:db');
        expect(pings())->toBe(['https://hc-ping.com/db-check']);

        Http::fake(['hc-ping.com/*' => Http::response('OK')]);
        config(['pibls.backup.public_key' => null]);
        $exit = Artisan::call('pibls:backup:db');

        expect($exit)->toBe(1)
            ->and(pings())->toContain('https://hc-ping.com/db-check/fail');
    });

    it('sem chave pública não grava dump nenhum (nunca em texto claro)', function () {
        config(['pibls.backup.public_key' => '']);

        $exit = Artisan::call('pibls:backup:db');

        expect($exit)->toBe(1)
            ->and(Artisan::output())->toContain('BACKUP_PUBLIC_KEY')
            ->and(glob($this->backupDir.'/*') ?: [])->toBe([]);
    });

    it('falha no ping não interrompe o backup', function () {
        Http::fake(['hc-ping.com/*' => fn () => throw new ConnectionException('timeout')]);

        $exit = Artisan::call('pibls:backup:db');

        expect($exit)->toBe(0)->and(glob($this->backupDir.'/db-*.sql.gz.enc'))->toHaveCount(1);
    });
});

describe('interruptor BACKUPS_ENABLED', function () {
    it('desligado (homologação e local), nenhum comando faz nada nem avisa o Healthchecks', function () {
        config(['pibls.backup.enabled' => false]);
        Storage::fake('b2');

        expect(Artisan::call('pibls:backup:db'))->toBe(0)
            ->and(Artisan::call('pibls:backup:offsite'))->toBe(0);

        expect(Artisan::output())->toContain('BACKUPS_ENABLED=false');
        expect(is_dir($this->backupDir))->toBeFalse()
            ->and(Storage::disk('b2')->allFiles())->toBe([]);
        Http::assertNothingSent();
    });

    it('o padrão é desligado: um ambiente sem a variável nunca gera backup por engano', function () {
        expect(file_get_contents(config_path('pibls.php')))->toContain("env('BACKUPS_ENABLED', false)");
        expect(file_get_contents(base_path('.env.example')))->toContain('BACKUPS_ENABLED=false');
    });
});

describe('Healthchecks (I-08)', function () {
    it('pinga com timeout de 5 s e uma nova tentativa, e sem URL não faz nada', function () {
        app(Healthchecks::class)->success('backup_db');
        app(Healthchecks::class)->fail('backup_offsite');
        app(Healthchecks::class)->success('retention_purge'); // sem URL configurada

        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => $request->url() === 'https://hc-ping.com/db-check' && $request->method() === 'GET');
        Http::assertSent(fn (Request $request) => $request->url() === 'https://hc-ping.com/offsite-check/fail');
    });

    it('tenta de novo uma vez quando o primeiro ping falha', function () {
        $calls = 0;
        Http::fake(['hc-ping.com/*' => function () use (&$calls) {
            $calls++;
            if ($calls === 1) {
                throw new ConnectionException('timeout');
            }

            return Http::response('OK');
        }]);

        app(Healthchecks::class)->success('backup_db');

        expect($calls)->toBe(2);
    });
});

describe('pibls:backup:offsite', function () {
    beforeEach(function () {
        Storage::fake('b2');
        Storage::fake('uploads');
    });

    it('envia o dump do dia para db/daily/AAAA-MM-DD, sem a cópia mensal fora do dia 1', function () {
        Carbon::setTestNow('2026-03-10 06:30:00'); // 03:30 em São Paulo
        localBackup($this->backupDir, 'db-20260310-060000.sql.gz.enc', 'DUMP-DE-HOJE', now()->subMinutes(30));

        $exit = Artisan::call('pibls:backup:offsite');

        expect($exit)->toBe(0);
        Storage::disk('b2')->assertExists('db/daily/2026-03-10.sql.gz.enc');
        expect(Storage::disk('b2')->get('db/daily/2026-03-10.sql.gz.enc'))->toBe('DUMP-DE-HOJE');
        expect(Storage::disk('b2')->allFiles('db/monthly'))->toBe([]);
        expect(pings())->toBe(['https://hc-ping.com/offsite-check']);
    });

    it('no dia 1 envia também a cópia mensal db/monthly/AAAA-MM', function () {
        Carbon::setTestNow('2026-04-01 06:30:00');
        localBackup($this->backupDir, 'db-20260401-060000.sql.gz.enc', 'DUMP-DO-MES', now()->subMinutes(30));

        Artisan::call('pibls:backup:offsite');

        Storage::disk('b2')->assertExists('db/daily/2026-04-01.sql.gz.enc');
        Storage::disk('b2')->assertExists('db/monthly/2026-04.sql.gz.enc');
        expect(Storage::disk('b2')->get('db/monthly/2026-04.sql.gz.enc'))->toBe('DUMP-DO-MES');
    });

    it('usa o dia de São Paulo para nomear a cópia, mesmo quando em UTC já virou o dia', function () {
        Carbon::setTestNow('2026-03-11 01:30:00'); // ainda 10/03 22:30 em São Paulo
        localBackup($this->backupDir, 'db-20260311-010000.sql.gz.enc', 'X', now()->subMinutes(30));

        Artisan::call('pibls:backup:offsite');

        Storage::disk('b2')->assertExists('db/daily/2026-03-10.sql.gz.enc');
    });

    it('sincroniza só os uploads novos, sem reenviar os que já estão lá e sem os arquivos ocultos', function () {
        Carbon::setTestNow('2026-03-10 06:30:00');
        localBackup($this->backupDir, 'db-20260310-060000.sql.gz.enc', 'D', now()->subMinutes(30));
        Storage::disk('uploads')->put('boletins/2026/a.pdf', 'LOCAL-A');
        Storage::disk('uploads')->put('eventos/2026/b.webp', 'LOCAL-B');
        Storage::disk('uploads')->put('.htaccess', 'Options -Indexes');
        Storage::disk('b2')->put('uploads/boletins/2026/a.pdf', 'JA-NO-B2');

        Artisan::call('pibls:backup:offsite');

        expect(Storage::disk('b2')->get('uploads/boletins/2026/a.pdf'))->toBe('JA-NO-B2')
            ->and(Storage::disk('b2')->get('uploads/eventos/2026/b.webp'))->toBe('LOCAL-B');
        Storage::disk('b2')->assertMissing('uploads/.htaccess');
    });

    it('nunca apaga nada no B2, nem o que não existe mais no servidor', function () {
        Carbon::setTestNow('2026-03-10 06:30:00');
        localBackup($this->backupDir, 'db-20260310-060000.sql.gz.enc', 'D', now()->subMinutes(30));
        Storage::disk('b2')->put('uploads/apagado-no-servidor.pdf', 'FICA');
        Storage::disk('b2')->put('db/daily/2025-01-01.sql.gz.enc', 'ANTIGO');

        Artisan::call('pibls:backup:offsite');

        Storage::disk('b2')->assertExists('uploads/apagado-no-servidor.pdf');
        Storage::disk('b2')->assertExists('db/daily/2025-01-01.sql.gz.enc');
    });

    it('falha com /fail quando não há dump recente (mais de 26 h) e não envia nada', function () {
        Carbon::setTestNow('2026-03-10 06:30:00');
        localBackup($this->backupDir, 'db-20260309-000000.sql.gz.enc', 'VELHO', now()->subHours(30));

        $exit = Artisan::call('pibls:backup:offsite');

        expect($exit)->toBe(1)->and(pings())->toBe(['https://hc-ping.com/offsite-check/fail']);
        expect(Storage::disk('b2')->allFiles())->toBe([]);
    });

    it('falha com /fail quando a pasta de backups está vazia', function () {
        $exit = Artisan::call('pibls:backup:offsite');

        expect($exit)->toBe(1)->and(pings())->toBe(['https://hc-ping.com/offsite-check/fail']);
    });
});

describe('OffsiteBackup: tentativas', function () {
    /** Um disco que falha as primeiras `$failures` gravações e depois grava de verdade. */
    function flakyDisk(int $failures): Filesystem
    {
        $real = Storage::fake('flaky');
        $disk = Mockery::mock(Filesystem::class);
        $disk->shouldReceive('exists')->andReturn(false);
        $disk->shouldReceive('allFiles')->andReturn([]);
        $calls = 0;
        $disk->shouldReceive('writeStream')->andReturnUsing(function (string $path, $stream) use (&$calls, $failures, $real) {
            $calls++;
            if ($calls <= $failures) {
                throw new RuntimeException('B2 fora do ar');
            }

            return $real->writeStream($path, $stream);
        });

        return $disk;
    }

    it('espera 1, 5 e 15 minutos entre as tentativas e conclui quando uma funciona', function () {
        $slept = [];
        $uploads = Storage::fake('uploads');
        $file = localBackup($this->backupDir, 'db-x.sql.gz.enc', 'DUMP');

        $copy = new OffsiteBackup(flakyDisk(2), $uploads, [60, 300, 900], function (int $seconds) use (&$slept): void {
            $slept[] = $seconds;
        });
        $copy->run($file, now()->subMinute());

        expect($slept)->toBe([60, 300]);
        Storage::disk('flaky')->assertExists('db/daily/'.now('America/Sao_Paulo')->format('Y-m-d').'.sql.gz.enc');
    });

    it('desiste depois da terceira nova tentativa e lança a última falha', function () {
        $slept = [];
        $uploads = Storage::fake('uploads');
        $file = localBackup($this->backupDir, 'db-x.sql.gz.enc', 'DUMP');

        $copy = new OffsiteBackup(flakyDisk(99), $uploads, [60, 300, 900], function (int $seconds) use (&$slept): void {
            $slept[] = $seconds;
        });

        expect(fn () => $copy->run($file, now()->subMinute()))->toThrow(RuntimeException::class, 'B2 fora do ar');
        expect($slept)->toBe([60, 300, 900]);
    });
});

describe('configuração do B2 (I-09)', function () {
    it('o disco b2 é S3 compatível, com timeout de 60 s e endereçamento por caminho', function () {
        $disk = config('filesystems.disks.b2');

        expect($disk['driver'])->toBe('s3')
            ->and($disk['use_path_style_endpoint'])->toBeTrue()
            ->and($disk['http']['timeout'] ?? null)->toBe(60)
            ->and($disk['throw'])->toBeTrue();
    });
});
