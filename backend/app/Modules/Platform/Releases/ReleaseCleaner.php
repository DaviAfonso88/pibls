<?php

declare(strict_types=1);

namespace App\Modules\Platform\Releases;

use RuntimeException;

/**
 * Limpeza semanal das releases no servidor (architecture.md → Tarefas do agendador): mantém as `$keep` mais novas e os
 * `assets/` delas. O ativador (`deploy/finalize.php`) só acrescenta releases; sem esta rotina a conta enche (inodes e disco).
 *
 * Layout (`finalize.php`): `<base>/current.php` (ponteiro), `<base>/releases/<AAAA.MM.N>/{backend,spa}` e
 * `<base>/deploy/status/current.json` (a release anterior, alvo do rollback).
 *
 * Travas: nunca apaga a release ativa nem a anterior; só toca em pastas cujo nome é um id de release; sem ponteiro válido
 * não faz nada; e só limpa o `assets/` do docroot se a `spa/` da release ativa tiver os próprios assets (senão a "união
 * dos assets" seria vazia e apagaria o site inteiro).
 */
class ReleaseCleaner
{
    private const RELEASE_ID = '/^\d{4}\.(0[1-9]|1[0-2])\.\d{1,5}$/';

    /**
     * @return array{kept: list<string>, removed: list<string>, assets_removed: int}
     */
    public function clean(string $base, string $docroot, int $keep = 5): array
    {
        $active = $this->activeRelease($base);
        $previous = $this->previousRelease($base);

        $releases = $this->releases($base);
        $protected = array_values(array_unique(array_filter([$active, $previous])));
        $newest = array_slice($releases, -$keep);
        $kept = array_values(array_intersect($releases, array_unique([...$newest, ...$protected])));

        $removed = [];
        foreach (array_diff($releases, $kept) as $id) {
            $this->removeTree("{$base}/releases/{$id}");
            $removed[] = $id;
        }

        return ['kept' => $kept, 'removed' => $removed, 'assets_removed' => $this->cleanAssets($base, $docroot, $kept, $active)];
    }

    /**
     * Ids de release existentes, do mais antigo para o mais novo (ordem de versão, não de texto: 2026.11.10 > 2026.11.9).
     *
     * @return list<string>
     */
    private function releases(string $base): array
    {
        $ids = array_filter(
            scandir("{$base}/releases") ?: [],
            fn (string $name): bool => preg_match(self::RELEASE_ID, $name) === 1 && is_dir("{$base}/releases/{$name}") && ! is_link("{$base}/releases/{$name}"),
        );

        usort($ids, fn (string $a, string $b): int => array_map('intval', explode('.', $a)) <=> array_map('intval', explode('.', $b)));

        return $ids;
    }

    private function activeRelease(string $base): string
    {
        $pointer = is_file("{$base}/current.php") ? include "{$base}/current.php" : null;

        if (! is_string($pointer) || preg_match('#^releases/(\d{4}\.(0[1-9]|1[0-2])\.\d{1,5})$#', $pointer, $match) !== 1 || ! is_dir("{$base}/{$pointer}")) {
            throw new RuntimeException('Sem release ativa válida em current.php: nada foi apagado.');
        }

        return $match[1];
    }

    private function previousRelease(string $base): ?string
    {
        $file = "{$base}/deploy/status/current.json";
        $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        $id = is_array($data) ? ($data['previous_release_id'] ?? null) : null;

        return is_string($id) && preg_match(self::RELEASE_ID, $id) === 1 ? $id : null;
    }

    /**
     * Apaga de `<docroot>/assets/` o que nenhuma release mantida usa (nomes com hash, cumulativos por desenho).
     *
     * @param  list<string>  $kept
     */
    private function cleanAssets(string $base, string $docroot, array $kept, string $active): int
    {
        $activeAssets = $this->assetNames("{$base}/releases/{$active}/spa/assets");
        if ($activeAssets === [] || ! is_dir("{$docroot}/assets")) {
            return 0;
        }

        $needed = [];
        foreach ($kept as $id) {
            foreach ($this->assetNames("{$base}/releases/{$id}/spa/assets") as $name) {
                $needed[$name] = true;
            }
        }

        $removed = 0;
        foreach ($this->assetNames("{$docroot}/assets") as $name) {
            if (! isset($needed[$name]) && @unlink("{$docroot}/assets/{$name}")) {
                $removed++;
            }
        }

        return $removed;
    }

    /** @return list<string> nomes dos arquivos (só o primeiro nível: o build do Vite não usa subpastas em `assets/`) */
    private function assetNames(string $directory): array
    {
        if (! is_dir($directory)) {
            return [];
        }

        return array_values(array_filter(
            scandir($directory) ?: [],
            fn (string $name): bool => $name !== '.' && $name !== '..' && is_file("{$directory}/{$name}"),
        ));
    }

    private function removeTree(string $path): void
    {
        if (is_link($path) || is_file($path)) {
            @unlink($path);

            return;
        }

        foreach (array_diff(scandir($path) ?: [], ['.', '..']) as $name) {
            $this->removeTree("{$path}/{$name}");
        }
        @rmdir($path);
    }
}
