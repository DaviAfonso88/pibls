<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Ativador de release (ADR-010; architecture.md → DevOps → Ativador)
|--------------------------------------------------------------------------
|
| Roda pelo cron do cPanel a cada 5 minutos:
|
|     php /home/USUARIO/private/bin/finalize.php pibls
|     php /home/USUARIO/private/bin/finalize.php pibls-homolog
|
| Sem SSH, é isto que instala uma release: o CI envia por FTPS um pacote para `private/<app>/deploy/inbox/` (o
| `manifest.json` por último) e este script o valida, migra, publica e troca o ponteiro `current.php`. Termina em
| menos de 1 s quando não há nada a fazer.
|
| PHP puro, sem framework e sem shell_exec. Os comandos do artisan rodam por proc_open com o próprio PHP_BINARY (o
| mesmo PHP CLI do cron), sem depender do caminho do binário.
|
| Layout (base = /home/USUARIO/private/<app>/; docroot = public_html ou homolog_html):
|
|     current.php                   ponteiro atômico: <?php return 'releases/2026.11.3';
|     releases/<id>/backend/        Laravel completo, com vendor/
|     releases/<id>/spa/            build da SPA (cópia, usada no rollback)
|     shared/.env, shared/storage/  fora das releases; o artisan os encontra por PIBLS_SHARED_PATH
|     deploy/inbox/                 pacote enviado pelo CI
|     deploy/status/<id>.json       resultado, lido pelo CI
|     deploy/lock/finalize.lock     um ativador por vez
|
| Passos de uma ativação: lock → manifest → SHA-256 do pacote → extração e conferência de cada arquivo → pibls:doctor
| → migrate → optimize → cópia de assets/, demais arquivos e .html para o docroot → troca do ponteiro → snapshots e
| auditoria. Qualquer falha antes da troca deixa a release anterior ativa (pelo expand/contract, ela é compatível
| com o schema novo).
|
| Opções (usadas pelos testes): --home=<pasta> troca a pasta que contém `private/` e o docroot.
|
*/

if (PHP_SAPI !== 'cli') {
    exit(1);
}

final class Finalizer
{
    /** Aplicação → pasta do docroot dentro do home da conta. */
    private const APPS = ['pibls' => 'public_html', 'pibls-homolog' => 'homolog_html'];

    /** O deploy nunca escreve nestes nomes na raiz do docroot (ADR-006; Ativador, passo 8). */
    private const PROTECTED_ROOT_NAMES = ['uploads', 'data', '.well-known', 'cgi-bin'];

    private const RELEASE_ID_PATTERN = '/^\d{4}\.(0[1-9]|1[0-2])\.\d{1,5}$/';

    private const HTACCESS_BEGIN = '# BEGIN pibls';

    private const HTACCESS_END = '# END pibls';

    /** Um manifest recém-chegado pode estar incompleto (upload em andamento): espera antes de dar o pacote como inválido. */
    private const MANIFEST_GRACE_SECONDS = 120;

    /** Pacotes sem manifest há mais que isto são restos de upload interrompido. */
    private const ABANDONED_UPLOAD_SECONDS = 86400;

    private readonly string $base;

    private readonly string $docroot;

    private readonly string $inbox;

    private readonly string $statusDir;

    private readonly string $releases;

    private readonly string $shared;

    /** @var resource|null */
    private $lock = null;

    private ?string $releaseId = null;

    private ?string $gitSha = null;

    private ?string $startedAt = null;

    public function __construct(private readonly string $app, string $home)
    {
        $this->base = "{$home}/private/{$app}";
        $this->docroot = $home.'/'.self::APPS[$app];
        $this->inbox = "{$this->base}/deploy/inbox";
        $this->statusDir = "{$this->base}/deploy/status";
        $this->releases = "{$this->base}/releases";
        $this->shared = "{$this->base}/shared";
    }

    /**
     * @param  list<string>  $argv
     */
    public static function main(array $argv): int
    {
        $options = [];
        $positional = [];
        foreach (array_slice($argv, 1) as $argument) {
            if (str_starts_with($argument, '--') && str_contains($argument, '=')) {
                [$key, $value] = explode('=', substr($argument, 2), 2);
                $options[$key] = $value;
            } else {
                $positional[] = $argument;
            }
        }

        $app = $positional[0] ?? '';
        if (! isset(self::APPS[$app])) {
            fwrite(STDERR, 'Uso: php finalize.php <'.implode('|', array_keys(self::APPS))."> [--home=<pasta>]\n");

            return 2;
        }

        return (new self($app, rtrim($options['home'] ?? dirname(__DIR__, 2), '/\\')))->run();
    }

    public function run(): int
    {
        foreach ([$this->inbox, $this->statusDir, $this->releases, "{$this->base}/deploy/lock"] as $directory) {
            if (! is_dir($directory) && ! @mkdir($directory, 0755, true) && ! is_dir($directory)) {
                fwrite(STDERR, "Não foi possível criar {$directory}.\n");

                return 1;
            }
        }

        if (! $this->acquireLock()) {
            return 0; // outro ativador está rodando
        }

        try {
            $this->removeAbandonedUploads();

            if (is_file("{$this->inbox}/rollback.json")) {
                return $this->rollback();
            }

            if (! is_file("{$this->inbox}/manifest.json")) {
                $this->heartbeat(true);

                return 0;
            }

            return $this->activate();
        } catch (Throwable $e) {
            $this->log('error', 'Falha inesperada: '.get_class($e).': '.$e->getMessage());

            return $this->fail('unexpected', 'Erro inesperado no ativador: '.$e->getMessage());
        } finally {
            $this->releaseLock();
        }
    }

    // ----------------------------------------------------------------------------------------------------------
    // Ativação
    // ----------------------------------------------------------------------------------------------------------

    private function activate(): int
    {
        $manifestPath = "{$this->inbox}/manifest.json";
        $manifest = json_decode((string) @file_get_contents($manifestPath), true);

        // O id, mesmo com o resto do manifest inválido, deixa o status chegar ao CI, que espera status/<id>.json
        if (is_array($manifest) && is_string($manifest['release_id'] ?? null) && preg_match(self::RELEASE_ID_PATTERN, $manifest['release_id']) === 1) {
            $this->releaseId = $manifest['release_id'];
            $this->startedAt = gmdate('Y-m-d\TH:i:s\Z');
        }

        if (! is_array($manifest)) {
            // O manifest vai por último, mas um FTP lento pode ter deixado só um pedaço: dá um tempo antes de desistir
            if (time() - (int) @filemtime($manifestPath) < self::MANIFEST_GRACE_SECONDS) {
                return 0;
            }

            return $this->fail('manifest', 'O manifest.json está ilegível.');
        }

        $problem = $this->validateManifest($manifest);
        if ($problem !== null) {
            return $this->fail('manifest', $problem);
        }

        /** @var array{release_id: string, git_sha?: string, package: array{name: string, sha256: string}, files: array<string, string>} $manifest */
        $this->releaseId = $manifest['release_id'];
        $this->gitSha = is_string($manifest['git_sha'] ?? null) ? $manifest['git_sha'] : null;
        $this->startedAt = gmdate('Y-m-d\TH:i:s\Z');
        $this->writeStatus('running', 'start', 'Ativação iniciada.');
        $this->log('info', "Ativando a release {$this->releaseId}.");

        // 1. SHA-256 do pacote contra o manifest
        $package = "{$this->inbox}/{$manifest['package']['name']}";
        if (! is_file($package) || ! hash_equals($manifest['package']['sha256'], (string) hash_file('sha256', $package))) {
            return $this->fail('checksum', 'O SHA-256 do pacote não confere com o manifest.');
        }

        // 2. Extração para uma pasta temporária e conferência de cada arquivo; só então vira a release
        $releaseDir = "{$this->releases}/{$this->releaseId}";
        if ($this->activeRelease() === $this->releaseId) {
            return $this->fail('exists', "A release {$this->releaseId} já é a ativa.");
        }

        $extracted = $this->extract($package, $manifest['files'], $releaseDir);
        if ($extracted !== null) {
            return $this->fail('extract', $extracted);
        }

        $backend = "{$releaseDir}/backend";

        // 3. pibls:doctor
        $doctor = $this->artisan($backend, ['pibls:doctor', '--json']);
        if ($doctor['exit'] !== 0) {
            return $this->fail('doctor', 'O pibls:doctor encontrou problemas.', $doctor['output']);
        }

        // 4. migrate e optimize (com o usuário de DDL), na release nova e com o .env compartilhado
        $migrate = $this->artisan($backend, ['migrate', '--force', '--database=migrator']);
        if ($migrate['exit'] !== 0) {
            return $this->fail('migrate', 'As migrations falharam; a release anterior continua ativa.', $migrate['output']);
        }

        $optimize = $this->artisan($backend, ['optimize']);
        if ($optimize['exit'] !== 0) {
            return $this->fail('optimize', 'O php artisan optimize falhou; a release anterior continua ativa.', $optimize['output']);
        }

        // 5. Arquivos públicos: assets/ (novos, com hash), demais arquivos, .html e, por fim, o bloco do .htaccess
        try {
            $this->publishSpa("{$releaseDir}/spa");
        } catch (Throwable $e) {
            return $this->fail('publish', 'Não foi possível publicar os arquivos públicos: '.$e->getMessage());
        }

        // 6. Troca atômica do ponteiro
        $previous = $this->activeRelease();
        $this->switchPointer($this->releaseId);

        // 7. Depois da troca: snapshots e auditoria. Falha aqui não desfaz a ativação.
        $post = $this->artisan($backend, ['pibls:release:activated', $this->releaseId]);
        if ($post['exit'] !== 0) {
            $this->log('warning', 'pibls:release:activated falhou: '.$this->tail($post['output']));
        }

        $this->writeStatus('active', 'done', 'Release ativa.', ['previous_release_id' => $previous, 'post_activation_ok' => $post['exit'] === 0]);
        $this->writeCurrent($this->releaseId, $previous);
        $this->clearInbox();
        $this->log('info', "Release {$this->releaseId} ativa (anterior: ".($previous ?? 'nenhuma').').');
        $this->heartbeat(true);

        return 0;
    }

    /**
     * @param  array<mixed>  $manifest
     */
    private function validateManifest(array $manifest): ?string
    {
        $id = $manifest['release_id'] ?? null;
        if (! is_string($id) || preg_match(self::RELEASE_ID_PATTERN, $id) !== 1) {
            return 'release_id inválido no manifest (esperado AAAA.MM.N).';
        }

        $package = $manifest['package'] ?? null;
        if (! is_array($package)
            || ($package['name'] ?? null) !== "release-{$id}.tar.gz"
            || ! is_string($package['sha256'] ?? null)
            || preg_match('/^[0-9a-f]{64}$/', $package['sha256']) !== 1) {
            return 'package inválido no manifest.';
        }

        $files = $manifest['files'] ?? null;
        if (! is_array($files) || $files === []) {
            return 'A lista de arquivos do manifest está vazia.';
        }

        foreach ($files as $path => $hash) {
            if (! $this->isSafeRelativePath((string) $path) || ! is_string($hash) || preg_match('/^[0-9a-f]{64}$/', $hash) !== 1) {
                return 'O manifest tem um arquivo com caminho ou SHA-256 inválido.';
            }
        }

        foreach (['backend/artisan', 'backend/vendor/autoload.php'] as $required) {
            if (! isset($files[$required])) {
                return "O pacote não tem {$required}.";
            }
        }

        return null;
    }

    /**
     * Extrai o pacote numa pasta temporária, confere que contém exatamente os arquivos do manifest, com o mesmo
     * SHA-256, e só então a renomeia para `releases/<id>`. Devolve a mensagem de erro, ou `null` se deu certo.
     *
     * @param  array<string, string>  $files
     */
    private function extract(string $package, array $files, string $releaseDir): ?string
    {
        $temporary = sprintf('%s/.%s.tmp-%s', $this->releases, basename($releaseDir), bin2hex(random_bytes(4)));

        try {
            (new PharData($package))->extractTo($temporary, null, true);
        } catch (Throwable $e) {
            $this->removeTree($temporary);

            return 'Não foi possível extrair o pacote: '.$e->getMessage();
        }

        $found = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($temporary, FilesystemIterator::SKIP_DOTS | FilesystemIterator::UNIX_PATHS),
        );
        foreach ($iterator as $file) {
            if ($file->isLink()) {
                $this->removeTree($temporary);

                return 'O pacote contém um link simbólico, que não é aceito.';
            }

            if ($file->isFile()) {
                $found[substr($file->getPathname(), strlen($temporary) + 1)] = $file->getPathname();
            }
        }

        $unexpected = array_diff_key($found, $files);
        $missing = array_diff_key($files, $found);
        if ($unexpected !== [] || $missing !== []) {
            $this->removeTree($temporary);

            return 'O conteúdo do pacote difere do manifest'
                .($unexpected !== [] ? ' (a mais: '.implode(', ', array_slice(array_keys($unexpected), 0, 3)).')' : '')
                .($missing !== [] ? ' (faltando: '.implode(', ', array_slice(array_keys($missing), 0, 3)).')' : '').'.';
        }

        foreach ($files as $path => $hash) {
            if (! hash_equals($hash, (string) hash_file('sha256', $found[$path]))) {
                $this->removeTree($temporary);

                return "O SHA-256 de {$path} não confere com o manifest.";
            }
        }

        // Uma tentativa anterior com o mesmo id pode ter falhado no meio (ex.: migrate): recomeça do zero
        $this->removeTree($releaseDir);
        $this->normalizePermissions($temporary);

        if (! @rename($temporary, $releaseDir)) {
            $this->removeTree($temporary);

            return 'Não foi possível criar a pasta da release.';
        }

        @copy("{$this->inbox}/manifest.json", "{$releaseDir}/manifest.json");

        return null;
    }

    // ----------------------------------------------------------------------------------------------------------
    // Rollback (passo 10): não roda migrations
    // ----------------------------------------------------------------------------------------------------------

    private function rollback(): int
    {
        $request = json_decode((string) @file_get_contents("{$this->inbox}/rollback.json"), true);
        $target = is_array($request) ? ($request['release_id'] ?? null) : null;

        $this->startedAt = gmdate('Y-m-d\TH:i:s\Z');
        $this->releaseId = is_string($target) && preg_match(self::RELEASE_ID_PATTERN, $target) === 1 ? $target : null;

        if ($this->releaseId === null) {
            return $this->fail('rollback', 'rollback.json sem um release_id válido.');
        }

        $releaseDir = "{$this->releases}/{$this->releaseId}";
        if (! is_dir("{$releaseDir}/spa") || ! is_file("{$releaseDir}/backend/vendor/autoload.php")) {
            return $this->fail('rollback', "A release {$this->releaseId} não existe mais no servidor.");
        }

        $this->writeStatus('running', 'rollback', 'Rollback iniciado.');
        $this->log('info', "Rollback para a release {$this->releaseId}.");

        try {
            $this->publishSpa("{$releaseDir}/spa");
        } catch (Throwable $e) {
            return $this->fail('rollback', 'Não foi possível restaurar os arquivos públicos: '.$e->getMessage());
        }

        $previous = $this->activeRelease();
        $this->switchPointer($this->releaseId);

        $post = $this->artisan("{$releaseDir}/backend", ['pibls:release:activated', $this->releaseId, '--rolled-back']);
        if ($post['exit'] !== 0) {
            $this->log('warning', 'pibls:release:activated falhou no rollback: '.$this->tail($post['output']));
        }

        $this->writeStatus('active', 'done', 'Rollback concluído.', ['via' => 'rollback', 'previous_release_id' => $previous]);
        $this->writeCurrent($this->releaseId, $previous);
        $this->clearInbox();
        $this->log('info', "Rollback concluído: {$this->releaseId} (saiu: ".($previous ?? 'nenhuma').').');
        $this->heartbeat(true);

        return 0;
    }

    // ----------------------------------------------------------------------------------------------------------
    // Arquivos públicos
    // ----------------------------------------------------------------------------------------------------------

    /**
     * Copia o build da SPA para o docroot: `assets/` primeiro (nomes com hash; uma página ainda no ar não quebra), os
     * demais arquivos, depois os `.html` e, por último, o bloco do `.htaccess`. Cada arquivo é gravado num temporário
     * e renomeado. Nunca toca `uploads/`, `data/`, `.well-known/` nem `cgi-bin/`.
     */
    private function publishSpa(string $spa): void
    {
        if (! is_dir($spa)) {
            throw new RuntimeException('A pasta spa/ da release não existe.');
        }

        if (! is_dir($this->docroot) && ! @mkdir($this->docroot, 0755, true) && ! is_dir($this->docroot)) {
            throw new RuntimeException("O docroot {$this->docroot} não existe e não pôde ser criado.");
        }

        // Valida o .htaccess ANTES de copiar qualquer coisa: se ele for recusado, o docroot não fica pela metade
        $htaccess = is_file("{$spa}/.htaccess") ? $this->mergedHtaccess("{$spa}/.htaccess", "{$this->docroot}/.htaccess") : null;

        $entries = array_values(array_diff(scandir($spa) ?: [], ['.', '..']));
        $assets = array_filter($entries, fn (string $name) => $name === 'assets');
        $html = array_filter($entries, fn (string $name) => is_file("{$spa}/{$name}") && str_ends_with($name, '.html'));
        $others = array_diff($entries, $assets, $html, ['.htaccess']);

        foreach ([...$assets, ...$others, ...$html] as $name) {
            if (in_array($name, self::PROTECTED_ROOT_NAMES, true)) {
                $this->log('warning', "O pacote traz {$name}/ na raiz da SPA; ignorado (pasta protegida).");

                continue;
            }

            $this->copyEntry("{$spa}/{$name}", "{$this->docroot}/{$name}");
        }

        if ($htaccess !== null) {
            $this->writeHtaccess("{$this->docroot}/.htaccess", $htaccess);
        }
    }

    private function copyEntry(string $source, string $destination): void
    {
        if (is_link($source)) {
            return;
        }

        if (is_dir($source)) {
            if (! is_dir($destination) && ! @mkdir($destination, 0755, true) && ! is_dir($destination)) {
                throw new RuntimeException("Não foi possível criar {$destination}.");
            }

            foreach (array_diff(scandir($source) ?: [], ['.', '..']) as $name) {
                $this->copyEntry("{$source}/{$name}", "{$destination}/{$name}");
            }

            return;
        }

        // Mesmo conteúdo: nada a fazer (os assets têm o hash no nome e não mudam)
        if (is_file($destination)
            && filesize($destination) === filesize($source)
            && hash_file('sha256', $destination) === hash_file('sha256', $source)) {
            return;
        }

        $temporary = $destination.'.tmp-'.bin2hex(random_bytes(4));
        if (! @copy($source, $temporary)) {
            throw new RuntimeException("Não foi possível copiar para {$destination}.");
        }
        @chmod($temporary, 0644);

        if (! @rename($temporary, $destination)) {
            @unlink($temporary);

            throw new RuntimeException("Não foi possível publicar {$destination}.");
        }
    }

    /**
     * O `.htaccess` do docroot também guarda o que o cPanel escreve (handler do PHP, proteção por senha da
     * homologação). Por isso só o bloco entre `# BEGIN pibls` e `# END pibls` é substituído; o resto fica como está.
     */
    private function mergedHtaccess(string $source, string $destination): ?string
    {
        $block = trim((string) file_get_contents($source));

        // Os marcadores só valem sozinhos na linha e uma vez cada: citados num comentário confundiriam a mescla
        $begin = '/^'.preg_quote(self::HTACCESS_BEGIN, '/').'$/m';
        $end = '/^'.preg_quote(self::HTACCESS_END, '/').'$/m';
        if (preg_match_all($begin, $block) !== 1 || preg_match_all($end, $block) !== 1) {
            throw new RuntimeException('O .htaccess da release precisa ter uma linha "# BEGIN pibls" e uma "# END pibls", cada uma uma vez.');
        }

        $current = is_file($destination) ? (string) file_get_contents($destination) : '';
        $pattern = '/^'.preg_quote(self::HTACCESS_BEGIN, '/').'$.*?^'.preg_quote(self::HTACCESS_END, '/').'$/ms';

        $merged = preg_match($pattern, $current) === 1
            ? (string) preg_replace_callback($pattern, fn () => $block, $current, 1)
            : rtrim($current)."\n\n".$block."\n";

        $merged = ltrim($merged, "\n");

        return $merged === $current ? null : $merged;
    }

    private function writeHtaccess(string $destination, string $merged): void
    {
        $temporary = $destination.'.tmp-'.bin2hex(random_bytes(4));
        if (file_put_contents($temporary, $merged) === false || ! @rename($temporary, $destination)) {
            @unlink($temporary);

            throw new RuntimeException('Não foi possível atualizar o .htaccess.');
        }
        @chmod($destination, 0644);
    }

    // ----------------------------------------------------------------------------------------------------------
    // Ponteiro, estado e status
    // ----------------------------------------------------------------------------------------------------------

    /** A release ativa, lida do ponteiro (`<?php return 'releases/2026.11.3';`). */
    private function activeRelease(): ?string
    {
        $pointer = "{$this->base}/current.php";
        if (! is_file($pointer)) {
            return null;
        }

        $value = (string) @file_get_contents($pointer);

        return preg_match("/return\\s+'releases\\/([^'\\/]+)';/", $value, $match) === 1 ? $match[1] : null;
    }

    /** Escreve `current.php.tmp` e o renomeia para `current.php`: a troca é atômica. */
    private function switchPointer(string $releaseId): void
    {
        $temporary = "{$this->base}/current.php.tmp";
        file_put_contents($temporary, "<?php return 'releases/{$releaseId}';\n");
        @chmod($temporary, 0644);

        if (! rename($temporary, "{$this->base}/current.php")) {
            throw new RuntimeException('Não foi possível trocar o ponteiro current.php.');
        }
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function writeStatus(string $state, string $step, string $message, array $extra = [], ?string $output = null): void
    {
        if ($this->releaseId === null) {
            return;
        }

        $status = [
            'release_id' => $this->releaseId,
            'state' => $state,
            'step' => $step,
            'message' => $message,
            'git_sha' => $this->gitSha,
            'app' => $this->app,
            'started_at' => $this->startedAt,
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ] + $extra;

        if ($output !== null) {
            $status['output_tail'] = $this->tail($output);
        }

        $this->writeJson("{$this->statusDir}/{$this->releaseId}.json", $status);
    }

    /** `status/current.json`: a release ativa e a anterior (o `rollback.yml` usa a anterior como padrão). */
    private function writeCurrent(string $releaseId, ?string $previous): void
    {
        $this->writeJson("{$this->statusDir}/current.json", [
            'release_id' => $releaseId,
            'previous_release_id' => $previous === $releaseId ? null : $previous,
            'activated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function writeJson(string $path, array $data): void
    {
        $temporary = $path.'.tmp-'.bin2hex(random_bytes(4));
        file_put_contents($temporary, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)."\n");
        @chmod($temporary, 0644);
        rename($temporary, $path);
    }

    /** Registra a falha, esvazia a caixa de entrada (senão o cron tentaria de novo a cada 5 min) e avisa o Healthchecks. */
    private function fail(string $step, string $message, ?string $output = null): int
    {
        $this->log('error', "Falha em {$step}: {$message}");
        $this->writeStatus('failed', $step, $message, [], $output);
        $this->clearInbox();
        $this->heartbeat(false);

        return 1;
    }

    private function clearInbox(): void
    {
        foreach (glob("{$this->inbox}/*") ?: [] as $file) {
            if (is_file($file)) {
                @unlink($file);
            }
        }
    }

    private function removeAbandonedUploads(): void
    {
        if (is_file("{$this->inbox}/manifest.json") || is_file("{$this->inbox}/rollback.json")) {
            return;
        }

        foreach (glob("{$this->inbox}/*") ?: [] as $file) {
            if (is_file($file) && time() - (int) filemtime($file) > self::ABANDONED_UPLOAD_SECONDS) {
                @unlink($file);
            }
        }
    }

    // ----------------------------------------------------------------------------------------------------------
    // Processos, lock, log e heartbeat
    // ----------------------------------------------------------------------------------------------------------

    /**
     * Roda `php artisan …` na pasta do backend da release, com o .env e o storage compartilhados.
     *
     * @param  list<string>  $arguments
     * @return array{exit: int, output: string}
     */
    private function artisan(string $backend, array $arguments): array
    {
        $environment = array_merge(getenv(), ['PIBLS_SHARED_PATH' => $this->shared]);
        $process = @proc_open(
            [PHP_BINARY, 'artisan', ...$arguments],
            [1 => ['pipe', 'w'], 2 => ['redirect', 1]],
            $pipes,
            $backend,
            $environment,
        );

        if (! is_resource($process)) {
            return ['exit' => 127, 'output' => 'Não foi possível iniciar o PHP CLI.'];
        }

        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);
        $exit = proc_close($process);

        return ['exit' => $exit, 'output' => $output === false ? '' : $output];
    }

    private function acquireLock(): bool
    {
        $handle = fopen("{$this->base}/deploy/lock/finalize.lock", 'c');
        if ($handle === false || ! flock($handle, LOCK_EX | LOCK_NB)) {
            return false;
        }

        $this->lock = $handle;

        return true;
    }

    private function releaseLock(): void
    {
        if (is_resource($this->lock)) {
            flock($this->lock, LOCK_UN);
            fclose($this->lock);
        }
    }

    private function log(string $level, string $message): void
    {
        $directory = "{$this->shared}/storage/logs";
        if (! is_dir($directory) && ! @mkdir($directory, 0755, true) && ! is_dir($directory)) {
            return;
        }

        @file_put_contents(
            $directory.'/finalize-'.gmdate('Y-m-d').'.log',
            json_encode(['timestamp' => gmdate('Y-m-d\TH:i:s\Z'), 'level' => $level, 'app' => $this->app, 'release' => $this->releaseId, 'message' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)."\n",
            FILE_APPEND | LOCK_EX,
        );
    }

    /** Ping no Healthchecks (`FINALIZE_PING_URL` no .env compartilhado): sucesso no fim, `/fail` na falha. */
    private function heartbeat(bool $ok): void
    {
        $url = $this->envValue('FINALIZE_PING_URL');
        if ($url === null || ! preg_match('#^https://#', $url)) {
            return;
        }

        $context = stream_context_create(['http' => ['method' => 'GET', 'timeout' => 10, 'ignore_errors' => true]]);
        @file_get_contents(rtrim($url, '/').($ok ? '' : '/fail'), false, $context);
    }

    private function envValue(string $key): ?string
    {
        $file = "{$this->shared}/.env";
        if (! is_file($file)) {
            return null;
        }

        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            if (preg_match('/^\s*'.preg_quote($key, '/').'\s*=\s*(.*)$/', $line, $match) === 1) {
                $value = trim($match[1]);

                return trim($value, "\"'") === '' ? null : trim($value, "\"'");
            }
        }

        return null;
    }

    // ----------------------------------------------------------------------------------------------------------
    // Utilitários
    // ----------------------------------------------------------------------------------------------------------

    private function isSafeRelativePath(string $path): bool
    {
        return $path !== ''
            && ! str_starts_with($path, '/')
            && ! str_contains($path, '\\')
            && ! str_contains($path, "\0")
            && preg_match('#(^|/)\.\.?(/|$)#', $path) !== 1;
    }

    private function tail(string $text, int $length = 2000): string
    {
        $text = trim($text);

        return strlen($text) <= $length ? $text : '…'.substr($text, -$length);
    }

    private function normalizePermissions(string $directory): void
    {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST,
        );
        foreach ($iterator as $entry) {
            @chmod($entry->getPathname(), $entry->isDir() ? 0755 : 0644);
        }
        @chmod($directory, 0755);
    }

    private function removeTree(string $path): void
    {
        if (! file_exists($path) && ! is_link($path)) {
            return;
        }

        if (is_file($path) || is_link($path)) {
            @unlink($path);

            return;
        }

        foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $name) {
            $this->removeTree("{$path}/{$name}");
        }
        @rmdir($path);
    }
}

if (isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    exit(Finalizer::main($argv));
}
