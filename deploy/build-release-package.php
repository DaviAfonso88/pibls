<?php

declare(strict_types=1);

/*
|--------------------------------------------------------------------------
| Monta o pacote de release (DevOps → Pipeline de CD, passo 2)
|--------------------------------------------------------------------------
|
| Uso: php build-release-package.php <pasta-com-backend-e-spa> <release-id> <git-sha> <pasta-de-saída>
|
| A pasta de entrada tem `backend/` (Laravel com vendor/, sem testes) e `spa/` (build da SPA). Gera na saída:
|   - release-<id>.tar.gz   com tudo isso;
|   - manifest.json          com o SHA-256 do pacote e de cada arquivo dentro dele.
|
| O CI envia o pacote primeiro e o manifest por último: a presença do manifest no servidor significa que o upload
| terminou. O ativador (finalize.php) confere os dois antes de tocar em qualquer coisa.
|
| PHP puro, sem dependências: roda no CI e nos testes do ativador.
*/

if (PHP_SAPI !== 'cli') {
    exit(1);
}

/**
 * @return array{package: string, manifest: string}
 */
function buildReleasePackage(string $source, string $releaseId, string $gitSha, string $outputDir): array
{
    if (preg_match('/^\d{4}\.(0[1-9]|1[0-2])\.\d{1,5}$/', $releaseId) !== 1) {
        throw new InvalidArgumentException("release-id inválido: {$releaseId} (esperado AAAA.MM.N)");
    }

    $source = rtrim($source, '/\\');
    foreach (['backend', 'spa'] as $required) {
        if (! is_dir("{$source}/{$required}")) {
            throw new InvalidArgumentException("A pasta {$source}/{$required} não existe.");
        }
    }

    if (! is_dir($outputDir) && ! mkdir($outputDir, 0755, true) && ! is_dir($outputDir)) {
        throw new RuntimeException("Não foi possível criar {$outputDir}.");
    }

    // Segredo nunca viaja no pacote: o .env fica só no servidor, em shared/ (DevOps → Injeção de segredos)
    if (is_file("{$source}/backend/.env")) {
        throw new InvalidArgumentException('backend/.env não pode ir no pacote de release.');
    }

    // O id da release vai dentro do backend, onde o Laravel o lê (`config('pibls.release')`)
    file_put_contents("{$source}/backend/RELEASE", $releaseId."\n");

    $files = [];
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS | FilesystemIterator::UNIX_PATHS),
        RecursiveIteratorIterator::LEAVES_ONLY,
    );
    foreach ($iterator as $file) {
        if (! $file->isFile() || $file->isLink()) {
            continue;
        }

        $relative = substr($file->getPathname(), strlen($source) + 1);
        $files[$relative] = hash_file('sha256', $file->getPathname());
    }
    ksort($files);

    $tarPath = "{$outputDir}/release-{$releaseId}.tar";
    $gzPath = "{$tarPath}.gz";
    foreach ([$tarPath, $gzPath] as $stale) {
        if (is_file($stale)) {
            unlink($stale);
        }
    }

    $archive = new PharData($tarPath);
    $archive->buildFromDirectory($source);
    $archive->compress(Phar::GZ);
    unset($archive);
    Phar::unlinkArchive($tarPath);

    $manifest = [
        'release_id' => $releaseId,
        'git_sha' => $gitSha,
        'created_at' => gmdate('Y-m-d\TH:i:s\Z'),
        'package' => [
            'name' => basename($gzPath),
            'sha256' => hash_file('sha256', $gzPath),
        ],
        'files' => $files,
    ];

    $manifestPath = "{$outputDir}/manifest.json";
    file_put_contents($manifestPath, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n");

    return ['package' => $gzPath, 'manifest' => $manifestPath];
}

if (isset($argv[0]) && realpath($argv[0]) === __FILE__) {
    if ($argc !== 5) {
        fwrite(STDERR, "Uso: php build-release-package.php <pasta-com-backend-e-spa> <release-id> <git-sha> <pasta-de-saída>\n");
        exit(2);
    }

    try {
        $result = buildReleasePackage($argv[1], $argv[2], $argv[3], $argv[4]);
    } catch (Throwable $e) {
        fwrite(STDERR, 'Erro: '.$e->getMessage()."\n");
        exit(1);
    }

    echo "Pacote:   {$result['package']}\nManifest: {$result['manifest']}\n";
}
